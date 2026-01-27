
/**
 * BACKEND SERVER (Node.js / Express)
 * Este arquivo deve rodar no servidor (ex: Vercel Functions, AWS Lambda ou Container).
 * Ele protege as chaves de API e normaliza as respostas.
 */

import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { GoogleGenAI } from "@google/genai";

const app = express();
app.use(cors());
app.use(express.json());

// --- CONFIGURAÇÃO ---
const PORT = process.env.PORT || 3000;

// Chaves carregadas do ambiente (Secure)
const KEYS = {
  APIBRASIL_TOKEN: process.env.APIBRASIL_TOKEN,
  DETRAN_KEY: process.env.DETRAN_API_KEY,
  GEMINI: process.env.GEMINI_API_KEY,
  OPENAI: process.env.OPENAI_API_KEY,
  ANTHROPIC: process.env.ANTHROPIC_API_KEY,
  GROQ: process.env.GROQ_API_KEY
};

// URLs Base
const URLS = {
  APIBRASIL: process.env.APIBRASIL_URL || 'https://gateway.apibrasil.com.br/api/v2/vehicles',
  DETRAN: process.env.DETRAN_API_URL || 'https://api.mock.detran'
};

// --- CACHE EM MEMÓRIA (Simples) ---
// Em produção, use Redis.
const plateCache = new Map();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

// --- ADAPTERS (Normalização de Dados) ---
const normalizeVehicleData = (source, provider) => {
  if (provider === 'apibrasil') {
    // Exemplo de mapeamento para APIBrasil
    return {
      plate: source.placa,
      brand: source.marca,
      model: source.modelo,
      yearFab: source.ano_fabricacao,
      yearModel: source.ano_modelo,
      color: source.cor,
      fuel: source.combustivel,
      chassi: source.chassi, // Muitas vezes mascarado no plano free
      renavam: source.renavam, // Muitas vezes mascarado
      uf: source.uf,
      city: source.municipio,
      status: source.situacao || 'Regular',
      provider: 'APIBrasil'
    };
  }
  
  if (provider === 'detran') {
    return {
      plate: source.plate,
      brand: source.brand_name,
      model: source.model_name,
      yearFab: source.manufacturing_year,
      yearModel: source.model_year,
      color: source.color_name,
      fuel: source.fuel_type,
      chassi: source.vin,
      renavam: source.renavam_code,
      uf: source.state,
      city: source.city,
      status: source.status,
      provider: 'Detran-SP'
    };
  }

  // Fallback Mock
  return {
    plate: source.plate,
    brand: source.brand,
    model: source.model,
    yearFab: source.yearFab,
    yearModel: source.yearModel,
    color: source.color,
    fuel: source.fuel,
    provider: 'Mock/Fallback'
  };
};

// --- PROVIDERS IMPLEMENTATION ---

async function fetchAPIBrasil(plate) {
  if (!KEYS.APIBRASIL_TOKEN) throw new Error('Credenciais APIBrasil não configuradas');
  
  try {
    const response = await axios.post(`${URLS.APIBRASIL}/dados`, 
      { placa: plate },
      { 
        headers: { 'Authorization': `Bearer ${KEYS.APIBRASIL_TOKEN}` },
        timeout: 5000 
      }
    );
    
    if (response.data && !response.data.error) {
      return normalizeVehicleData(response.data, 'apibrasil');
    }
    throw new Error('Placa não encontrada na APIBrasil');
  } catch (error) {
    // Repassar erro 404 (não encontrado) ou lançar erro genérico para trigger fallback
    if (error.response?.status === 404) return null; // Não existe, não adianta tentar outro provider se a base for nacional
    throw error; 
  }
}

async function fetchDetran(plate) {
  // NOTA: Integração Real com Detran exige Certificado Digital (e-CNPJ) e VPN na maioria dos casos.
  // Aqui simulamos uma chamada REST para fins de arquitetura.
  if (!KEYS.DETRAN_KEY) throw new Error('Credenciais Detran não configuradas');

  try {
    // Simulação de chamada
    // const agent = new https.Agent({ pfx: fs.readFileSync(process.env.DETRAN_CERT_PATH) });
    // const response = await axios.get(`${URLS.DETRAN}/consulta/${plate}`, { httpsAgent: agent });
    
    // MOCK RESPONSE para o exemplo
    if (plate === 'DETRAN1') throw new Error('Simulação de Erro Detran');
    
    return normalizeVehicleData({
        plate: plate,
        brand_name: 'HONDA',
        model_name: 'CIVIC TOURING',
        manufacturing_year: '2023',
        model_year: '2023',
        color_name: 'BRANCA',
        fuel_type: 'GASOLINA',
        vin: '93H...........',
        renavam_code: '123456789',
        state: 'SP',
        city: 'SANTOS',
        status: 'EM CIRCULAÇÃO'
    }, 'detran');

  } catch (error) {
    throw error;
  }
}

async function fetchMock(plate) {
  await new Promise(r => setTimeout(r, 600));
  if (plate === 'AAA0000') return null; // Simula não encontrado

  return normalizeVehicleData({
      plate: plate,
      brand: 'TOYOTA',
      model: 'COROLLA XEI',
      yearFab: '2023',
      yearModel: '2024',
      color: 'PRATA',
      fuel: 'FLEX',
  }, 'mock');
}

// --- ENDPOINT: CONSULTA VEICULAR (MULTI-PROVIDER) ---
app.get('/api/vehicles/lookup', async (req, res) => {
  const { plate, provider = 'auto' } = req.query;

  if (!plate || plate.length < 7) {
    return res.status(400).json({ error: 'Placa inválida.' });
  }

  const cleanPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Check Cache
  const cached = plateCache.get(cleanPlate);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL_MS)) {
    console.log(`[Lookup] Cache hit para ${cleanPlate}`);
    return res.json({ ...cached.data, cached: true });
  }

  let result = null;
  let errors = [];

  try {
    // LÓGICA DE FALLBACK / SELEÇÃO
    if (provider === 'apibrasil') {
        result = await fetchAPIBrasil(cleanPlate);
    } else if (provider === 'detran') {
        result = await fetchDetran(cleanPlate);
    } else {
        // AUTO MODE: Tenta APIBrasil -> Se falhar (erro técnico/limite), tenta Detran -> Se falhar, Mock
        try {
            console.log(`[Lookup] Tentando Primário (APIBrasil)...`);
            result = await fetchAPIBrasil(cleanPlate);
        } catch (e) {
            console.warn(`[Lookup] Primário falhou: ${e.message}. Tentando Secundário (Detran)...`);
            errors.push(`APIBrasil: ${e.message}`);
            try {
                result = await fetchDetran(cleanPlate);
            } catch (e2) {
                console.warn(`[Lookup] Secundário falhou: ${e2.message}. Usando Mock.`);
                errors.push(`Detran: ${e2.message}`);
                result = await fetchMock(cleanPlate); // Último recurso (Mock para MVP)
            }
        }
    }

    if (!result) {
        return res.status(404).json({ error: 'Veículo não encontrado em nenhuma base.', details: errors });
    }

    // Save to Cache
    plateCache.set(cleanPlate, { data: result, timestamp: Date.now() });

    return res.json(result);

  } catch (error) {
    console.error('[Lookup Error]', error.message);
    return res.status(500).json({ error: 'Erro interno na consulta veicular.', details: errors });
  }
});

// --- ENDPOINT 2: CONSULTA CNPJ ---
app.get('/api/cnpj/lookup', async (req, res) => {
  const { cnpj } = req.query;
  if (!cnpj || cnpj.length < 14) return res.status(400).json({ error: 'CNPJ inválido.' });

  try {
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
      // ... Outros providers
      default:
        // Mock fallback
        resultText = "Simulação IA: " + prompt.substring(0, 50) + "..."; 
        break;
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
