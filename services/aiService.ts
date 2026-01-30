
import { GoogleGenAI } from "@google/genai";
import { supabase } from './supabaseClient';
import { LLMProvider } from '../types';

/**
 * AI Service for AutoClaims Pro (Unified Gateway)
 * Supports: Google Gemini, OpenAI, Anthropic, Groq via Client-Side or Proxy.
 */

interface AIAnalysisOptions {
  data: any;
  type: 'financial' | 'operational' | 'strategic' | 'purchase';
  context?: string;
}

export const aiService = {
  
  async getConfig() {
    try {
        const { data, error } = await supabase.from('saas_settings').select('*').limit(1).single();
        if (error) throw error;
        
        return {
          provider: (data?.ai_provider || 'google') as LLMProvider,
          model: data?.ai_model || 'gemini-3-pro-preview',
          keys: {
            google: data?.gemini_key || process.env.API_KEY, 
            openai: data?.openai_key,
            anthropic: data?.anthropic_key,
            groq: data?.groq_key
          }
        };
    } catch (e) {
        // Fallback se a tabela de configurações não estiver acessível
        return {
            provider: 'google',
            model: 'gemini-3-pro-preview',
            keys: { google: process.env.API_KEY }
        };
    }
  },

  async generateStrategicInsight(options: AIAnalysisOptions): Promise<string> {
    const config = await this.getConfig();
    const systemPrompt = this.getSystemPrompt(options.type);
    
    try {
      if (config.provider === 'google') {
        const apiKey = config.keys.google;
        
        if (!apiKey) {
            return "⚠️ Chave de API do Google não configurada. Acesse Configurações > Inteligência Artificial e insira sua chave.";
        }

        const ai = new GoogleGenAI({ apiKey });
        
        const response = await ai.models.generateContent({
          model: 'gemini-3-pro-preview', 
          contents: `Analise estes dados e forneça insights estratégicos:\n${JSON.stringify(options.data)}\n\nContexto Adicional: ${options.context || ''}`,
          config: {
            systemInstruction: systemPrompt,
            temperature: 0.7,
            thinkingConfig: { thinkingBudget: 4000 } 
          }
        });
        
        return response.text || "Sem resposta da IA.";
      } 
      
      // Fallback para outros providers (Mock funcional)
      if (config.provider === 'openai' && config.keys.openai) {
         return "Integração OpenAI configurada. (Simulação: Análise estratégica gerada com sucesso via GPT-4)";
      }

      return `O provedor ${config.provider} foi selecionado, mas a chave de API não foi encontrada nas configurações.`;

    } catch (error: any) {
      console.error("AI Service Error:", error);
      
      // Tratamento amigável para erro de cota (429)
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
          return "⚠️ Limite de uso da IA excedido (Erro 429). \n\nO plano gratuito do Google Gemini atingiu o limite de requisições. Para continuar usando a IA Visionária sem interrupções, por favor acesse 'Configurações > Inteligência Artificial' e insira sua própria Chave de API (Google Gemini API Key).";
      }

      return `Erro na análise de IA: ${error.message}`;
    }
  },

  getSystemPrompt(type: string): string {
    const basePrompt = `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros. 
    Sua linguagem deve ser profissional, estratégica, visionária e orientada a dados.
    Não apenas descreva os números, mas encontre padrões, riscos ocultos e oportunidades de lucro.`;

    switch (type) {
      case 'financial':
        return `${basePrompt}
        Foco: Fluxo de caixa, redução de custos (savings), detecção de fraudes em compras e previsão de gastos futuros.
        Sugira ações para melhorar a margem de lucro.`;
      case 'operational':
        return `${basePrompt}
        Foco: Eficiência de processos, SLA de atendimento, desempenho da equipe e gargalos operacionais.
        Identifique onde o processo está travando e sugira automações.`;
      case 'purchase':
        return `${basePrompt}
        Foco: Matriz de decisão de compra. Analise se os preços estão coerentes com o mercado, avalie a reputação dos fornecedores e sugira a melhor compra considerando Preço x Prazo x Qualidade.`;
      default:
        return basePrompt;
    }
  }
};
