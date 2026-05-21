import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function embed(text: string): Promise<number[]> {
  const r = await genai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return r.embeddings![0].values!;
}

async function main() {
  const query = "What is the penalty for diverting escrow funds in a RERA-registered project?";
  console.log(`Query: ${query}\n`);

  const queryEmbedding = await embed(query);
  console.log(`Embedding length: ${queryEmbedding.length}`);
  console.log(`First 5 values: ${queryEmbedding.slice(0, 5).map((v) => v.toFixed(4)).join(", ")}\n`);

  // Try passing as pgvector-formatted string instead of raw array
  const vectorString = `[${queryEmbedding.join(",")}]`;
  const { data, error } = await supabase.rpc("match_maharera_documents", {
    query_embedding: vectorString,
    match_threshold: 0.0,
    match_count: 10,
  });

  console.log("RPC raw result:");
  console.log("  data:", JSON.stringify(data, null, 2));
  console.log("  error:", JSON.stringify(error, null, 2));
  console.log();

  // JS-side cosine similarity to compare against what DB should produce
  console.log("--- JS-side cosine similarity (ground truth) ---");
  const { data: allRows } = await supabase
    .from("maharera_knowledge")
    .select("title, embedding");

  function parseEmbedding(raw: unknown): number[] | null {
    if (Array.isArray(raw)) return raw as number[];
    if (typeof raw === "string") {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return null;
  }

  function cosineSim(a: number[], b: number[]): number {
    let dot = 0,
      na = 0,
      nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    return dot / (Math.sqrt(na) * Math.sqrt(nb));
  }

  for (const r of allRows || []) {
    const emb = parseEmbedding(r.embedding);
    if (!emb) {
      console.log(`  [no embedding] ${r.title.slice(0, 60)}`);
      continue;
    }
    const sim = cosineSim(queryEmbedding, emb);
    console.log(`  ${sim.toFixed(4)}  dim=${emb.length}  ${r.title.slice(0, 60)}`);
  }

  // Sanity check: read raw rows and inspect embedding
  console.log("\n--- Raw table inspection ---");
  const { data: raw } = await supabase
    .from("maharera_knowledge")
    .select("id, title, source_type, embedding")
    .limit(3);

  for (const r of raw || []) {
    const emb = r.embedding as unknown;
    let dim = "n/a";
    let preview = "n/a";
    if (Array.isArray(emb)) {
      dim = String(emb.length);
      preview = (emb as number[]).slice(0, 3).map((v) => v.toFixed(4)).join(", ");
    } else if (typeof emb === "string") {
      dim = `${emb.length} chars (stored as string?)`;
      preview = emb.slice(0, 80);
    } else {
      dim = `type=${typeof emb}`;
    }
    console.log(`  ${r.title.slice(0, 50)} → dim=${dim}, preview=[${preview}]`);
  }
}

main().catch(console.error);
