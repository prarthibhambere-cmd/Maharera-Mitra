import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }
  return _ai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getAI().models.embedContent({
    model: "text-embedding-004",
    contents: text,
  });
  return response.embeddings![0].values!;
}

export { getAI as ai };
