import { GoogleGenAI } from "@google/genai";

/**
 * AI Service for AutoClaims Pro.
 * Provides strategic insights and executive summaries using Gemini models.
 */

export const getAIInsight = async (query: string, context: any) => {
  try {
    // Always use new GoogleGenAI({ apiKey: process.env.API_KEY }) as per guidelines.
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Upgraded to gemini-3-pro-preview for complex reasoning tasks as per guidelines.
    // Updated to use systemInstruction for better persona control and thinkingConfig for detailed reasoning.
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Usuário pergunta: ${query}`,
      config: {
        systemInstruction: `Você é um assistente estratégico de compras e seguros. 
        Contexto atual do sistema: ${JSON.stringify(context)}
        Responda de forma executiva, visionária e focada em redução de custos e SLA.`,
        temperature: 0.7,
        thinkingConfig: { thinkingBudget: 4000 } // Setting a thinking budget for complex reasoning.
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
      
      // Upgraded to gemini-3-pro-preview for high-quality executive summaries.
      const response = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Dados operacionais: ${JSON.stringify(data)}`,
        config: {
          systemInstruction: `Gere um resumo executivo diário para o gestor de seguros.
          Destaque: Eventos críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.`,
          thinkingConfig: { thinkingBudget: 2000 }
        }
      });
      
      // Access the extracted string directly via the .text property.
      return response.text;
    } catch (error) {
      console.error("Daily Summary Error:", error);
      return "Erro ao gerar resumo diário.";
    }
}
