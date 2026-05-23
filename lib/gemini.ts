import { GoogleGenAI } from "@google/genai";

let _ai: GoogleGenAI | null = null;

function getAI(): GoogleGenAI {
  if (!_ai) {
    _ai = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY!,
      // Pin the base URL to Google's real endpoint. Some hosts (e.g. Netlify
      // AI Gateway) auto-intercept AI SDK calls and route them through a proxy
      // that doesn't support every model — gemini-embedding-001 fails there
      // with "unable to find suitable provider". Calling Google directly with
      // our own API key avoids that and keeps embeddings + chat consistent.
      httpOptions: { baseUrl: "https://generativelanguage.googleapis.com" },
    });
  }
  return _ai;
}

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await getAI().models.embedContent({
    model: "gemini-embedding-001",
    contents: text,
    config: { outputDimensionality: 768 },
  });
  return response.embeddings![0].values!;
}

export { getAI as ai };
