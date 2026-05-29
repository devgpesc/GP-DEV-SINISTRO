
import { GoogleGenAI } from "@google/genai";

/**
 * AI Service for EventsCar.
 * Provides strategic insights and executive summaries using Gemini models.
 */

export const getAIInsight = async (query: string, context: any) => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Usuário pergunta: ${query}`,
      config: {
        // CORREÇÃO: Contexto explícito para evitar alucinação com eventos sociais
        systemInstruction: `Você é um assistente estratégico de compras e seguros (EventsCar). 
        Contexto: Gestão de Sinistros Automotivos (NÃO é gestão de festas/eventos sociais).
        Contexto atual do sistema: ${JSON.stringify(context)}
        Responda de forma executiva, visionária e focada em redução de custos e SLA.`,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 4000 } 
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
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Dados operacionais: ${JSON.stringify(data)}`,
        config: {
          systemInstruction: `Gere um resumo executivo diário para o gestor de seguros automotivos.
          Destaque: Sinistros críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.
          Não use termos de eventos sociais.`,
          thinkingConfig: { thinkingBudget: 2000 }
        }
      });
      
      return response.text;
    } catch (error) {
      console.error("Daily Summary Error:", error);
      return "Erro ao gerar resumo diário.";
    }
}
