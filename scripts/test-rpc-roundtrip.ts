import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
  // 1. Direct cast: does the function even receive the string?
  console.log("Test 1: Call match_maharera_documents with a TINY known vector (768 zeros except first 5)");
  const tinyVec = "[" + Array(768).fill(0).map((_, i) => (i < 5 ? 0.1 : 0)).join(",") + "]";
  console.log(`  Vector string length: ${tinyVec.length}`);

  const { data: d1, error: e1 } = await supabase.rpc("match_maharera_documents", {
    query_embedding: tinyVec,
    match_threshold: -1.0, // accept literally anything
    match_count: 10,
  });
  console.log(`  data rows: ${(d1 as unknown[] | null)?.length ?? "null"}`);
  console.log(`  error: ${JSON.stringify(e1)}`);
  if (d1 && Array.isArray(d1)) {
    for (const r of d1.slice(0, 5)) {
      const row = r as { similarity: number; title: string };
      console.log(`    sim=${row.similarity.toFixed(4)}  ${row.title.slice(0, 50)}`);
    }
  }

  // 2. Count rows with non-null embeddings
  console.log("\nTest 2: Count rows with non-null embeddings");
  const { count, error: ce } = await supabase
    .from("maharera_knowledge")
    .select("*", { count: "exact", head: true })
    .not("embedding", "is", null);
  console.log(`  count=${count}, error=${JSON.stringify(ce)}`);

  // 3. Pull one row's full embedding and check it's parsable as 768-d
  console.log("\nTest 3: Parse first embedding from DB and check dim");
  const { data: row } = await supabase
    .from("maharera_knowledge")
    .select("title, embedding")
    .limit(1)
    .single();
  if (row) {
    const emb = row.embedding;
    const parsed = typeof emb === "string" ? JSON.parse(emb) : emb;
    console.log(`  title: ${row.title.slice(0, 50)}`);
    console.log(`  typeof embedding: ${typeof emb}`);
    console.log(`  parsed length: ${Array.isArray(parsed) ? parsed.length : "not array"}`);
  }
}

main().catch(console.error);
