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

  if (error) {
    console.error("RPC error:", error);
    return;
  }

  console.log(`Matches (threshold=0.0, all rows ranked):\n`);
  for (const row of data || []) {
    console.log(`  ${row.similarity.toFixed(4)}  [${row.source_type}] ${row.title.slice(0, 70)}`);
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
