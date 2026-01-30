
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
      
      // Fallback para OpenAI
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
                     model: "gpt-4o-mini", // Modelo mais rápido e compatível
                     messages: [
                         { role: "system", content: systemPrompt },
                         { role: "user", content: `Dados: ${JSON.stringify(options.data)}. Contexto: ${options.context || ''}` }
                     ]
                 })
             });
             
             if (!res.ok) {
                 const errJson = await res.json().catch(() => ({}));
                 throw new Error(errJson.error?.message || `Erro HTTP ${res.status}`);
             }

             const json = await res.json();
             return json.choices?.[0]?.message?.content || "Erro ao processar com OpenAI.";
         } catch (e: any) {
             console.error("OpenAI Error:", e);
             return this.handleError(e);
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

        // --- OPENAI (GPT-4o-mini) ---
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
                    model: "gpt-4o-mini", // Alterado para gpt-4o-mini (mais compatível com novas chaves)
                    messages: [
                        { role: "system", content: chatSystemPrompt },
                        { role: "user", content: userMessage }
                    ],
                    temperature: 0.6
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `Erro HTTP ${res.status}`);
            }

            const json = await res.json();
            return json.choices?.[0]?.message?.content || "Sem resposta da OpenAI.";
        }

        return `Provedor ${config.provider} selecionado, mas não suportado no chat ainda.`;

    } catch (error: any) {
        return this.handleError(error);
    }
  },

  handleError(error: any): string {
      const msg = error.message?.toLowerCase() || '';
      
      if (msg.includes('429') || msg.includes('quota') || msg.includes('insufficient_quota')) {
          return "⚠️ Limite de cota excedido (Erro 429). \n\nSua conta OpenAI está sem créditos ou atingiu o limite. Verifique o faturamento em platform.openai.com.";
      }
      if (msg.includes('401') || msg.includes('invalid api key')) {
          return "⚠️ Chave API Inválida (Erro 401). \n\nVerifique se a chave foi copiada corretamente em Configurações > IA.";
      }
      if (msg.includes('fetch') || msg.includes('network') || msg.includes('failed to fetch')) {
          return "⚠️ Erro de Conexão (CORS/Network). \n\nA OpenAI bloqueou a chamada direta do navegador. \n\nSolução: Utilize a integração via backend ou verifique se sua rede permite acesso a api.openai.com.";
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
