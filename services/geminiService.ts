import { GoogleGenAI } from "@google/genai";

// Fix: Initialize GoogleGenAI with a direct reference to process.env.API_KEY as per guidelines
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getAIInsight = async (query: string, context: any) => {
  try {
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
    // Fix: Access the .text property directly (do not call as a method)
    return response.text;
  } catch (error) {
    console.error("AI Service Error:", error);
    return "Desculpe, não consegui processar essa análise no momento. Verifique sua conexão ou API Key.";
  }
};

export const getDailySummary = async (data: any) => {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `
          Gere um resumo executivo diário para o gestor de seguros.
          Dados operacionais: ${JSON.stringify(data)}
          Destaque: Eventos críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.
        `,
      });
      // Fix: Access the .text property directly
      return response.text;
    } catch (error) {
      return "Erro ao gerar resumo diário.";
    }
}