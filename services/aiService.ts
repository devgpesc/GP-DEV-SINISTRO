
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
            return "⚠️ Chave de API do Google não configurada. Acesse Configurações > IA e insira sua chave.";
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
      
      // Fallback para OpenAI (Simples fetch para não depender de SDK extra)
      if (config.provider === 'openai') {
         const apiKey = config.keys.openai;
         if (!apiKey) return "⚠️ Chave OpenAI não configurada. Acesse Configurações > IA.";

         try {
             const res = await fetch('https://api.openai.com/v1/chat/completions', {
                 method: 'POST',
                 headers: {
                     'Content-Type': 'application/json',
                     'Authorization': `Bearer ${apiKey}`
                 },
                 body: JSON.stringify({
                     model: "gpt-4-turbo",
                     messages: [
                         { role: "system", content: systemPrompt },
                         { role: "user", content: `Dados: ${JSON.stringify(options.data)}. Contexto: ${options.context || ''}` }
                     ]
                 })
             });
             const json = await res.json();
             return json.choices?.[0]?.message?.content || "Erro ao processar com OpenAI.";
         } catch (e: any) {
             return `Erro OpenAI: ${e.message}`;
         }
      }

      return `O provedor ${config.provider} foi selecionado, mas ainda não está totalmente implementado para relatórios.`;

    } catch (error: any) {
      console.error("AI Service Error:", error);
      return this.handleError(error);
    }
  },

  // Novo método para o Chat Assistente
  async chatWithContext(userMessage: string, contextData: any): Promise<string> {
    const config = await this.getConfig();
    
    // Prompt do Sistema para o Chat
    const chatSystemPrompt = `
      Você é o 'Cérebro Operacional' do AutoClaims Pro, um sistema de gestão de sinistros e compras.
      
      CONTEXTO ATUAL DO SISTEMA (DADOS REAIS):
      ${JSON.stringify(contextData, null, 2)}
      
      SUA MISSÃO:
      1. Atuar como um consultor sênior (CFO/COO).
      2. Responder perguntas sobre os dados acima (financeiro, operacional, compras).
      3. Sugerir otimizações se notar gargalos (ex: muitos eventos parados, custos altos).
      4. Ser direto, profissional e usar formatação Markdown (negrito, listas).
      
      Se o usuário perguntar algo fora do contexto dos dados, responda com base em melhores práticas de gestão de frotas e sinistros.
    `;

    try {
        // --- GOOGLE GEMINI ---
        if (config.provider === 'google') {
            const apiKey = config.keys.google;
            if (!apiKey) return "⚠️ Configure sua API Key do Google em Configurações > IA.";

            const ai = new GoogleGenAI({ apiKey });
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: userMessage,
                config: {
                    systemInstruction: chatSystemPrompt,
                    temperature: 0.6,
                }
            });
            return response.text || "Não entendi.";
        }

        // --- OPENAI (GPT-4) ---
        if (config.provider === 'openai') {
            const apiKey = config.keys.openai;
            if (!apiKey) return "⚠️ Configure sua API Key da OpenAI em Configurações > IA.";

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4-turbo",
                    messages: [
                        { role: "system", content: chatSystemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.6
                })
            });

            const json = await res.json();
            if (json.error) {
                return `Erro OpenAI: ${json.error.message}`;
            }
            return json.choices?.[0]?.message?.content || "Sem resposta da OpenAI.";
        }

        return `Provedor ${config.provider} selecionado, mas não suportado no chat ainda.`;

    } catch (error: any) {
        return this.handleError(error);
    }
  },

  handleError(error: any): string {
      if (error.message?.includes('429') || error.message?.includes('quota') || error.message?.includes('RESOURCE_EXHAUSTED')) {
          return "⚠️ Limite de uso da IA excedido (Erro 429). \n\nO plano gratuito atingiu o limite ou sua conta está sem créditos. Verifique sua chave API.";
      }
      return `Erro na IA: ${error.message}`;
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
