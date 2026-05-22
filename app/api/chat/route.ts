import { NextRequest, NextResponse } from "next/server";
import { ai as getAI, generateEmbedding } from "@/lib/gemini";
import { supabaseAdmin, type MatchResult } from "@/lib/supabaseClient";

// pdf-parse requires the Node.js runtime (not Edge)
export const runtime = "nodejs";
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are MahaRERA Mitra, an expert AI compliance assistant for the Maharashtra Real Estate Regulatory Authority (MahaRERA). You help developers, homebuyers, and legal professionals navigate the RERA Act 2016, MahaRERA circulars, and project compliance requirements.

When answering:
- Cite specific RERA sections or circular numbers when applicable.
- Be precise about regulatory timelines, penalties, and obligations.
- If the user uploads a document, analyze it against RERA compliance requirements section-by-section.
- Always clarify whether you're referencing the central RERA Act 2016 or Maharashtra-specific rules.
- Format responses with clear headings (##, ###) and bullet points for readability.
- Use **bold** for key compliance terms, deadlines, and penalty amounts.

If retrieved context is insufficient, say so explicitly and ask clarifying questions rather than guessing.`;

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const CHUNK_SIZE = 1500;
const CHUNK_OVERLAP = 150;
const RAG_MATCH_THRESHOLD = 0.62;
const RAG_MATCH_COUNT = 5;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface SourceCitation {
  title: string;
  sourceType: string;
  similarity: number;
}

function chunkText(text: string, size = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= size) return [clean];

  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    const end = Math.min(start + size, clean.length);
    chunks.push(clean.slice(start, end));
    if (end === clean.length) break;
    start = end - overlap;
  }
  return chunks;
}

async function extractPdfText(buffer: Buffer): Promise<{ text: string; pages: number }> {
  // Lazy-load pdf-parse ONLY when a PDF is actually uploaded. It pulls in
  // pdfjs-dist which uses Node internals that crash at import time on the
  // Cloudflare Workers runtime — a top-level import would 500 every request
  // (file or not). Dynamic import contains the blast radius to PDF uploads.
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  try {
    const info = await parser.getInfo();
    const result = await parser.getText();
    return { text: result.text, pages: info.pages?.length ?? 0 };
  } finally {
    await parser.destroy();
  }
}

async function ingestUploadedPdf(file: File): Promise<string> {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error(`File too large (max ${MAX_FILE_SIZE / 1024 / 1024} MB)`);
  }
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Only PDF files are supported");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { text, pages } = await extractPdfText(buffer);
  const fullText = text.trim();

  if (!fullText) {
    throw new Error("PDF contains no extractable text — may be a scanned image");
  }

  const chunks = chunkText(fullText);
  const db = supabaseAdmin();

  const rows = await Promise.all(
    chunks.map(async (chunk, idx) => ({
      source_type: "user-upload" as const,
      title: file.name,
      content: chunk,
      metadata: {
        originalSize: file.size,
        pages,
        chunkIndex: idx,
        totalChunks: chunks.length,
      },
      embedding: await generateEmbedding(chunk),
    }))
  );

  const { error } = await db.from("maharera_knowledge").insert(rows);
  if (error) {
    console.error("Failed to ingest uploaded PDF:", error.message);
  }

  return fullText.slice(0, 8000);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function parseStoredEmbedding(raw: unknown): number[] | null {
  if (Array.isArray(raw)) return raw as number[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as number[]) : null;
    } catch {
      return null;
    }
  }
  return null;
}

async function retrieveRagContext(
  query: string
): Promise<{ context: string; citations: SourceCitation[] }> {
  if (!query.trim()) return { context: "", citations: [] };

  try {
    const queryEmbedding = await generateEmbedding(query);
    const db = supabaseAdmin();

    // JS-side cosine similarity: fetch only canonical sources (act / circular).
    // User-uploaded PDFs live in the same table for ingestion bookkeeping but
    // should not surface as citations — the AI already gets the current upload
    // via uploadedContext, and citing the user's own document back to them is
    // noise. Past uploads stay in DB but are excluded from retrieval.
    const { data, error } = await db
      .from("maharera_knowledge")
      .select("id, source_type, title, content, metadata, embedding")
      .in("source_type", ["act", "circular"])
      .not("embedding", "is", null);

    if (error) {
      console.error("RAG fetch failed:", error.message);
      return { context: "", citations: [] };
    }

    const scored = (data ?? [])
      .map((row) => {
        const emb = parseStoredEmbedding(row.embedding);
        if (!emb) return null;
        return {
          ...row,
          similarity: cosineSimilarity(queryEmbedding, emb),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null)
      .filter((r) => r.similarity > RAG_MATCH_THRESHOLD)
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, RAG_MATCH_COUNT);

    if (scored.length === 0) return { context: "", citations: [] };

    const context = scored
      .map(
        (r) =>
          `[Source: ${r.source_type} — "${r.title}" (relevance ${r.similarity.toFixed(2)})]\n${r.content}`
      )
      .join("\n\n---\n\n");

    const citations: SourceCitation[] = scored.map((r) => ({
      title: r.title,
      sourceType: r.source_type,
      similarity: r.similarity,
    }));

    return { context, citations };
  } catch (err) {
    console.error("RAG retrieval error:", err);
    return { context: "", citations: [] };
  }
}

function buildGeminiContents(
  messages: ChatMessage[],
  ragContext: string,
  uploadedContext: string
) {
  const contents = messages.map((m) => ({
    role: m.role === "user" ? ("user" as const) : ("model" as const),
    parts: [{ text: m.content }],
  }));

  const contextBlock = [
    ragContext && `# RETRIEVED MAHARERA KNOWLEDGE BASE\n\n${ragContext}`,
    uploadedContext &&
      `# USER-UPLOADED DOCUMENT (excerpt)\n\n${uploadedContext}`,
  ]
    .filter(Boolean)
    .join("\n\n=====\n\n");

  if (contextBlock && contents.length > 0) {
    const last = contents[contents.length - 1];
    last.parts[0].text = `${contextBlock}\n\n# USER QUESTION\n\n${last.parts[0].text}`;
  }

  return contents;
}

function errorResponse(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(req: NextRequest) {
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorResponse("Invalid request body", 400);
  }

  const messagesRaw = formData.get("messages");
  if (typeof messagesRaw !== "string") {
    return errorResponse("Missing 'messages' field", 400);
  }

  let messages: ChatMessage[];
  try {
    messages = JSON.parse(messagesRaw);
    if (!Array.isArray(messages) || messages.length === 0) {
      throw new Error();
    }
  } catch {
    return errorResponse("Invalid 'messages' JSON — must be a non-empty array", 400);
  }

  const file = formData.get("file");
  const uploadFile = file instanceof File && file.size > 0 ? file : null;

  let uploadedContext = "";
  if (uploadFile) {
    try {
      uploadedContext = await ingestUploadedPdf(uploadFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "PDF processing failed";
      return errorResponse(msg, 400);
    }
  }

  const lastUserMessage =
    messages.filter((m) => m.role === "user").pop()?.content ?? "";

  const { context: ragContext, citations } = await retrieveRagContext(lastUserMessage);

  const geminiContents = buildGeminiContents(messages, ragContext, uploadedContext);

  let geminiStream;
  try {
    geminiStream = await getAI().models.generateContentStream({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_PROMPT,
        temperature: 0.3,
      },
      contents: geminiContents,
    });
  } catch (err) {
    console.error("Gemini API error:", err);
    return errorResponse("AI service unavailable — check GEMINI_API_KEY", 502);
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of geminiStream) {
          const text = chunk.text ?? "";
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      } catch (err) {
        console.error("Stream error:", err);
        controller.enqueue(
          encoder.encode("\n\n[Stream interrupted — please retry]")
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
      "X-Citations": Buffer.from(JSON.stringify(citations)).toString("base64"),
      "X-Has-Upload": uploadedContext ? "true" : "false",
    },
  });
}
