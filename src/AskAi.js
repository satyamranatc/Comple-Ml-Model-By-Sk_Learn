import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "AIzaSyDC0WZXFR9U-PBZCa-N70XHcTp1ANneSJw" });

export default async function AskAi(prompt) {
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: `You are a friendly, intelligent voice assistant. When you respond, speak like a real human would.
Avoid any markdown, special characters, or formatting. Do not use asterisks or lists.
Your answer should be in natural hindi mix with simple english, suitable for text-to-speech. Prompt: ${prompt}`,
  });
  console.log(response.text);
  return response.text
}

