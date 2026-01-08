
import { GoogleGenAI } from "@google/genai";

export const generateSlogan = async (url: string): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a short, catchy, professional call-to-action slogan in Mongolian for this website URL: ${url}. The slogan should encourage people to scan the QR code. Keep it under 10 words.`,
      config: {
        temperature: 0.7,
      },
    });

    return response.text || "Сканнердаж үзнэ үү!";
  } catch (error) {
    console.error("Gemini Error:", error);
    return "Энэхүү QR кодыг уншуулж нэвтэрнэ үү.";
  }
};
