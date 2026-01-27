
/**
 * BACKEND SERVER (Node.js / Express)
 * Este arquivo deve rodar no servidor (ex: Vercel Functions, AWS Lambda ou Container).
 * Ele protege as chaves de API e normaliza as respostas.
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";
// import OpenAI from 'openai'; // Descomentar em produção
// import Anthropic from '@anthropic-ai/sdk'; // Descomentar em produção
// import Groq from 'groq-sdk'; // Descomentar em produção

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO ---
const PORT = process.env.PORT || 3000;

// Chaves carregadas do ambiente (Secure)
const KEYS = {
  PLATE_API: process.env.PLATE_API_TOKEN,
  GEMINI: process.env.GEMINI_API_KEY,
  OPENAI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

// --- ENDPOINT 1: CONSULTA VEICULAR ---
app.get('/api/vehicles/lookup', async (req, res) => {
  const { plate } = req.query;

  if (!plate || plate.length < 7) {
    return res.status(400).json({ error: 'Placa inválida.' });
  }

  try {
    // Exemplo de integração com API Real (ex: API Placas, BrasilAPI paga, etc)
    // URL Mockada para exemplo - substitua pela URL real do fornecedor
    const apiUrl = `${process.env.PLATE_API_URL || 'https://api.placas.dev/v1'}/consultar/${plate}`;
    
    // Chamada Real (Descomentar com credenciais reais)
    /*
    const response = await axios.get(apiUrl, {
      headers: { 'Authorization': `Bearer ${KEYS.PLATE_API}` },
      timeout: 5000
    });
    const data = response.data;
    */

    // MOCK SERVER-SIDE (Para demonstração sem gastar créditos)
    // Simula delay de rede
    await new Promise(r => setTimeout(r, 800));
    
    // Verifica se a placa "existe" na base mockada
    if (plate.toUpperCase() === 'AAA0000') {
        return res.status(404).json({ error: 'Veículo não encontrado.' });
    }

    // Normalização de Dados (Adapter Pattern)
    const normalizedData = {
      plate: plate.toUpperCase(),
      brand: 'TOYOTA',
      model: 'COROLLA XEI',
      version: '2.0 FLEX AUTOMÁTICO',
      yearFab: '2023',
      yearModel: '2024',
      color: 'PRATA',
      fuel: 'FLEX',
      type: 'AUTOMOVEL',
      chassi: `9BG${Math.random().toString(36).substr(2, 14).toUpperCase()}`,
      renavam: Math.floor(10000000000 + Math.random() * 90000000000).toString(),
      uf: 'SP',
      city: 'SÃO PAULO',
      extra: {
        fipe_price: 145000.00,
        situation: 'EM CIRCULAÇÃO'
      }
    };

    return res.json(normalizedData);

  } catch (error) {
    console.error('[Lookup Error]', error.message);
    if (error.response?.status === 404) return res.status(404).json({ error: 'Placa não encontrada.' });
    if (error.response?.status === 429) return res.status(429).json({ error: 'Limite de requisições excedido.' });
    return res.status(500).json({ error: 'Erro interno na consulta veicular.' });
  }
});

// --- ENDPOINT 2: CONSULTA CNPJ ---
app.get('/api/cnpj/lookup', async (req, res) => {
  const { cnpj } = req.query;

  if (!cnpj || cnpj.length < 14) {
    return res.status(400).json({ error: 'CNPJ inválido.' });
  }

  try {
     // Mock response simulando ReceitaWS ou similar
     await new Promise(r => setTimeout(r, 600));

     return res.json({
       name: 'AUTO PEÇAS DEMO LTDA',
       fantasy: 'AUTO PEÇAS DEMO',
       city: 'SÃO PAULO',
       email: 'contato@demopecas.com.br',
       phone: '(11) 91234-5678'
     });
  } catch (error) {
     return res.status(500).json({ error: 'Erro na consulta CNPJ.' });
  }
});

// --- ENDPOINT 3: UNIFIED LLM GATEWAY ---
app.post('/api/llm/generate', async (req, res) => {
  const { provider, model, prompt, systemInstruction, maxTokens } = req.body;

  if (!prompt) return res.status(400).json({ error: 'Prompt é obrigatório.' });

  try {
    let resultText = '';

    switch (provider) {
      case 'google':
        if (!KEYS.GEMINI) throw new Error('Chave Gemini não configurada.');
        const ai = new GoogleGenAI({ apiKey: KEYS.GEMINI });
        const geminiModel = model || 'gemini-3-flash-preview';
        const response = await ai.models.generateContent({
          model: geminiModel,
          contents: prompt,
          config: {
            systemInstruction: systemInstruction,
            maxOutputTokens: maxTokens || 1024,
          }
        });
        resultText = response.text;
        break;

      case 'openai':
        if (!KEYS.OPENAI) throw new Error('Chave OpenAI não configurada.');
        // const openai = new OpenAI({ apiKey: KEYS.OPENAI });
        // const completion = await openai.chat.completions.create({ ... });
        resultText = "Simulação OpenAI: " + prompt.substring(0, 50) + "..."; 
        break;

      case 'anthropic':
        if (!KEYS.ANTHROPIC) throw new Error('Chave Anthropic não configurada.');
        // const anthropic = new Anthropic({ apiKey: KEYS.ANTHROPIC });
        resultText = "Simulação Claude: " + prompt.substring(0, 50) + "...";
        break;

      case 'groq':
        if (!KEYS.GROQ) throw new Error('Chave Groq não configurada.');
        // const groq = new Groq({ apiKey: KEYS.GROQ });
        resultText = "Simulação Groq: " + prompt.substring(0, 50) + "...";
        break;

      default:
        return res.status(400).json({ error: 'Provedor de IA desconhecido.' });
    }

    return res.json({ text: resultText, provider, model });

  } catch (error) {
    console.error('[LLM Error]', error);
    return res.status(500).json({ error: error.message || 'Erro ao processar IA.' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
