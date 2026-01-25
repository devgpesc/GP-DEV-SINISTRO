
import { GoogleGenAI } from "@google/genai";

// Função para obter a instância do AI de forma segura, evitando erro de 'process is not defined'
const getAiInstance = () => {
  const apiKey = (typeof process !== 'undefined' && process.env?.API_KEY) || '';
  if (!apiKey) {
    console.warn("AutoClaims Pro: API_KEY não encontrada no ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

export const getAIInsight = async (query: string, context: any) => {
  try {
    const ai = getAiInstance();
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `
        Você é um assistente estratégico de compras e seguros. 
        Contexto atual do sistema: ${JSON.stringify(context)}
        Usuário pergunta: ${query}
        Responda de forma executiva, visionária e focada em redução de custos e SLA.
      `,
      config: {
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 0 }
      }
    });
    return response.text;
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Desculpe, não consegui processar essa análise no momento. Verifique sua conexão ou API Key.";
  }
};

export const getDailySummary = async (data: any) => {
    try {
      const ai = getAiInstance();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          Gere um resumo executivo diário para o gestor de seguros.
          Dados operacionais: ${JSON.stringify(data)}
          Destaque: Eventos críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.
        `,
      });
      return response.text;
    } catch (error) {
      console.error("Daily Summary Error:", error);
      return "Erro ao gerar resumo diário.";
    }
}
