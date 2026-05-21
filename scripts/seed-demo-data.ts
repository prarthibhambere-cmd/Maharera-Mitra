/**
 * Seeds the maharera_knowledge table with a few realistic MahaRERA documents
 * so RAG retrieval has something to match against. Use this once after running
 * the SQL migration, before doing real PDF uploads.
 *
 * Usage: npx tsx scripts/seed-demo-data.ts
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await genai.models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings![0].values!;
}

const SEED_DOCS = [
  {
    source_type: "act" as const,
    title: "RERA Act 2016 — Section 11 (Functions and Duties of Promoter)",
    content: `Section 11 of the Real Estate (Regulation and Development) Act, 2016 lays down the functions and duties of the promoter. The promoter shall upon receiving his Login Id and password under clause (a) of sub-section (1) of section 5, create his web page on the website of the Authority and enter all details of the proposed project as provided under sub-section (2) of section 4. The promoter shall also be responsible for obtaining the completion certificate or the occupancy certificate. The promoter shall be responsible for providing and maintaining the essential services, on reasonable charges, till the taking over of the maintenance of the project by the association of the allottees. Liability for structural defect: In case any structural defect or any other defect in workmanship, quality or provision of services or any other obligations of the promoter as per the agreement for sale is brought to the notice of the promoter within a period of five years by the allottee from the date of handing over possession, it shall be the duty of the promoter to rectify such defects without further charge.`,
    metadata: { section: 11, chapter: "III" },
  },
  {
    source_type: "act" as const,
    title: "RERA Act 2016 — Section 13 (No Deposit Without Agreement for Sale)",
    content: `Section 13 of the RERA Act 2016 states that a promoter shall not accept a sum more than ten per cent of the cost of the apartment, plot, or building as the case may be, as an advance payment or an application fee, from a person without first entering into a written agreement for sale with such person and register the said agreement for sale, under any law for the time being in force. The agreement for sale referred to in sub-section (1) shall be in such form as may be prescribed and shall specify the particulars of development of the project including the construction of building and apartments, along with specifications and internal development works and external development works, the dates and the manner by which payments towards the cost of the apartment, plot or building, as the case may be, are to be made by the allottees and the date on which the possession of the apartment, plot or building is to be handed over.`,
    metadata: { section: 13, chapter: "III" },
  },
  {
    source_type: "circular" as const,
    title: "MahaRERA Circular 38/2023 — Quarterly Project Update Requirements",
    content: `MahaRERA Circular No. 38 of 2023 mandates that all promoters of registered projects must submit quarterly progress updates through the MahaRERA portal within 7 days of the end of each quarter. The quarterly update must include: (a) percentage of work completed on building and amenities, (b) status of statutory approvals, (c) inventory status (number of apartments booked, sold, and unsold), (d) financial disclosures of project bank account balances per Section 4(2)(l)(D) requirements, (e) updated completion date if any deviation from the original timeline. Failure to file quarterly updates within the prescribed timeline shall attract a penalty of Rs. 50,000 per quarter under Section 60 of the RERA Act 2016. Repeated non-compliance may result in suspension or revocation of project registration under Section 7 of the Act.`,
    metadata: { circularNumber: "38/2023", date: "2023-09-15" },
  },
  {
    source_type: "circular" as const,
    title: "MahaRERA Circular 27/2022 — Escrow Account Compliance under Section 4(2)(l)(D)",
    content: `Pursuant to Section 4(2)(l)(D) of the RERA Act 2016, every promoter shall deposit 70% of the amounts realized from the allottees for the real estate project in a separate account to be maintained in a scheduled bank to cover the cost of construction and the land cost. MahaRERA Circular 27/2022 clarifies that promoters must (i) open the project-specific escrow account at the time of project registration, (ii) name the account in the format "ProjectName-RERA-Escrow", (iii) submit certified bank statements quarterly along with quarterly updates, and (iv) ensure withdrawals are certified by an engineer, architect, and chartered accountant per Section 4(2)(l)(D) proviso. Penalty for diversion of escrow funds is up to 5% of the estimated cost of the project and may invite imprisonment up to 3 years under Section 60.`,
    metadata: { circularNumber: "27/2022", date: "2022-06-10" },
  },
  {
    source_type: "act" as const,
    title: "RERA Act 2016 — Section 18 (Refund Obligation on Delayed Possession)",
    content: `Section 18 of the RERA Act 2016 governs the consequences of a promoter's failure to complete or unable to give possession of an apartment, plot or building in accordance with the terms of the agreement for sale or due to discontinuance of his business as a developer on account of suspension or revocation of the registration. In such cases, the promoter is liable on demand to the allottees, in case the allottee wishes to withdraw from the project, to return the amount received by him in respect of that apartment with interest at such rate as may be prescribed in this behalf including compensation in the manner as provided under this Act. Where an allottee does not intend to withdraw from the project, he shall be paid by the promoter interest for every month of delay, till the handing over of the possession, at such rate as may be prescribed.`,
    metadata: { section: 18, chapter: "III" },
  },
];

async function main() {
  console.log("Seeding maharera_knowledge with demo documents...\n");

  for (const doc of SEED_DOCS) {
    process.stdout.write(`  → ${doc.title.slice(0, 60)}... `);
    const embedding = await generateEmbedding(`${doc.title}\n\n${doc.content}`);

    const { error } = await supabase.from("maharera_knowledge").insert({
      source_type: doc.source_type,
      title: doc.title,
      content: doc.content,
      metadata: doc.metadata,
      embedding,
    });

    if (error) {
      console.log("FAILED");
      console.error("    ", error.message);
    } else {
      console.log("OK");
    }
  }

  const { count } = await supabase
    .from("maharera_knowledge")
    .select("*", { count: "exact", head: true });
  console.log(`\nDone. Total rows in maharera_knowledge: ${count}`);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
