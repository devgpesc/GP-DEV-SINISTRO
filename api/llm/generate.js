import { GoogleGenAI } from '@google/genai';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Metodo nao permitido.' });
  }

  const { provider = 'google', model, prompt, systemInstruction, maxTokens, temperature } = req.body || {};
  if (!prompt) return res.status(400).json({ error: 'Prompt e obrigatorio.' });

  try {
    if (provider !== 'google') {
      return res.json({ text: `Simulacao IA: ${String(prompt).slice(0, 80)}...`, provider, model });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'Chave Gemini nao configurada no servidor.' });
    }

    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: model || 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction,
        maxOutputTokens: maxTokens || 1024,
        temperature: temperature ?? 0.7,
      },
    });

    return res.json({ text: response.text, provider, model });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Erro ao processar IA.' });
  }
}
