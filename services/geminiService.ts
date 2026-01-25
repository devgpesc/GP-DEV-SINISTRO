
import { GoogleGenAI } from "@google/genai";

/**
 * AI Service for AutoClaims Pro.
 * Provides strategic insights and executive summaries using Gemini models.
 */

export const getAIInsight = async (query: string, context: any) => {
  try {
    // Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Using gemini-3-flash-preview for general text reasoning and basic assistant tasks.
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
        thinkingConfig: { thinkingBudget: 0 } // Disabling thinking to prioritize low latency.
      }
    });
    
    // Access the extracted string directly via the .text property (not a method).
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
        model: 'gemini-3-flash-preview',
        contents: `
          Gere um resumo executivo diário para o gestor de seguros.
          Dados operacionais: ${JSON.stringify(data)}
          Destaque: Eventos críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.
        `,
      });
      
      // Access the extracted string directly via the .text property.
      return response.text;
    } catch (error) {
      console.error("Daily Summary Error:", error);
      return "Erro ao gerar resumo diário.";
    }
}
