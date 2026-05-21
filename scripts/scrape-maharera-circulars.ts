/**
 * Standalone script to scrape MahaRERA circulars from the public portal
 * and ingest them into Supabase with Gemini embeddings.
 *
 * Usage: npx tsx scripts/scrape-maharera-circulars.ts
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and GEMINI_API_KEY in .env
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface Circular {
  title: string;
  content: string;
  date: string;
  circularNumber: string;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return response.embeddings![0].values!;
}

async function fetchCirculars(): Promise<Circular[]> {
  // TODO: Implement actual scraping from https://maharera.maharashtra.gov.in
  // This requires fetching the circulars listing page, parsing the table,
  // and downloading each circular PDF for text extraction.
  //
  // For now, return an empty array. Replace with actual scraping logic
  // using fetch + cheerio or puppeteer.
  console.log(
    "Fetching circulars from MahaRERA portal... (implement scraping logic)"
  );
  return [];
}

async function ingestCirculars(circulars: Circular[]) {
  for (const circular of circulars) {
    console.log(`Processing: ${circular.title}`);

    const embedding = await generateEmbedding(
      `${circular.title}\n${circular.content.slice(0, 2000)}`
    );

    const { error } = await supabase.from("maharera_knowledge").insert({
      source_type: "circular",
      title: circular.title,
      content: circular.content,
      metadata: {
        circularNumber: circular.circularNumber,
        date: circular.date,
      },
      embedding,
    });

    if (error) {
      console.error(`Failed to insert ${circular.title}:`, error.message);
    } else {
      console.log(`Ingested: ${circular.title}`);
    }
  }
}

async function main() {
  console.log("MahaRERA Circular Scraper");
  console.log("========================\n");

  const circulars = await fetchCirculars();
  console.log(`Found ${circulars.length} circulars\n`);

  if (circulars.length > 0) {
    await ingestCirculars(circulars);
  }

  console.log("\nDone.");
}

main().catch(console.error);
