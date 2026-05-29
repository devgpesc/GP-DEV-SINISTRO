
import { llmService } from './llmService';

/**
 * AI Service for EventsCar.
 * Chamadas via backend (/api/llm/generate) — chaves nao ficam no bundle do cliente.
 */

export const getAIInsight = async (query: string, context: unknown) => {
  try {
    return await llmService.generateText({
      provider: 'google',
      model: 'gemini-3-pro-preview',
      systemInstruction: `Você é um assistente estratégico de compras e seguros (EventsCar).
        Contexto: Gestão de Sinistros Automotivos (NÃO é gestão de festas/eventos sociais).
        Contexto atual do sistema: ${JSON.stringify(context)}
        Responda de forma executiva, visionária e focada em redução de custos e SLA.`,
      prompt: `Usuário pergunta: ${query}`,
      temperature: 0.7,
    });
  } catch (error) {
    console.error('AI Service Error:', error);
    return 'Desculpe, não consegui processar essa análise no momento. Verifique sua conexão ou API Key.';
  }
};

export const getDailySummary = async (data: unknown) => {
  try {
    return await llmService.generateText({
      provider: 'google',
      model: 'gemini-3-pro-preview',
      systemInstruction: `Gere um resumo executivo diário para o gestor de seguros automotivos.
          Destaque: Sinistros críticos, economia potencial em cotações abertas, fornecedores com atrasos e sugestões de otimização de SLA.
          Não use termos de eventos sociais.`,
      prompt: `Dados operacionais: ${JSON.stringify(data)}`,
      temperature: 0.7,
    });
  } catch (error) {
    console.error('Daily Summary Error:', error);
    return 'Erro ao gerar resumo diário.';
  }
};
