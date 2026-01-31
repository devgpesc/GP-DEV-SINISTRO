
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

interface Attachment {
  type: string;
  base64?: string;
  mimeType: string;
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
            return "⚠️ Chave de API do Google não configurada.";
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
      
      // Fallback simplificado para outros provedores (não implementado full)
      return "IA Estratégica disponível apenas com Google Gemini 3 no momento.";

    } catch (error: any) {
      console.error("AI Service Error:", error);
      return this.handleError(error);
    }
  },

  // --- NOVO: CHAT DE SUPORTE TÉCNICO ---
  async chatSupport(message: string, userContext: any): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey || config.provider !== 'google') {
        // Fallback simples se não tiver Gemini configurado para suporte
        return "Olá. Para suporte avançado, por favor configure a chave do Google Gemini nas configurações.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const supportSystemPrompt = `
      Você é o Agente de Suporte Técnico Nível 1 da ESC Solutions, criadora do software EventPro.
      Seu objetivo é ajudar o usuário a navegar no sistema, resolver dúvidas operacionais e diagnosticar erros simples.
      
      CONTEXTO ATUAL DO USUÁRIO:
      ${JSON.stringify(userContext, null, 2)}
      
      DIRETRIZES:
      1. Seja educado, técnico mas acessível.
      2. Se o usuário perguntar sobre funcionalidades, explique onde clicar.
      3. Se o usuário relatar um "Erro" ou "Bug", peça detalhes ou sugira recarregar (F5).
      4. Se o problema parecer complexo, financeiro ou crítico, sugira explicitamente clicar no botão "Falar no WhatsApp" acima do chat.
      5. Não invente recursos que não existem. O sistema tem: Eventos, Cotações, Compras, Entregas, Fornecedores, Associados, Veículos e Relatórios.
      6. Responda em Português do Brasil.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Modelo mais rápido para chat
            contents: message,
            config: {
                systemInstruction: supportSystemPrompt,
                temperature: 0.5,
            }
        });
        return response.text || "Desculpe, não entendi. Pode reformular?";
    } catch (error: any) {
        console.error("Support AI Error", error);
        return "Estou com instabilidade momentânea. Por favor, utilize o botão de WhatsApp para suporte humano.";
    }
  },

  // CHAT MULTIMODAL AVANÇADO (CIO)
  async chatWithContext(userMessage: string, contextData: any, attachments: Attachment[] = []): Promise<string> {
    const config = await this.getConfig();
    
    // Prompt do Sistema para o Chat (Persona CIO)
    const chatSystemPrompt = `
      Você é o CIO Virtual (Chief Intelligence Officer) do AutoClaims Pro.
      Sua missão é atuar como um estrategista de negócios sênior.
      
      CAPACIDADES:
      1. Análise Financeira e Operacional baseada no contexto JSON fornecido.
      2. Visão Computacional: Analise imagens de avarias, notas fiscais ou documentos enviados.
      3. Audição: Transcreva e analise áudios de vistorias ou relatos enviados pelo usuário.
      
      DIRETRIZES DE RESPOSTA:
      - Seja executivo, direto e orientado a lucro/eficiência.
      - Use formatação Markdown (negrito, bullet points).
      - Se receber uma imagem de carro, identifique o dano e estime a categoria (Funilaria, Mecânica).
      - Se receber um áudio, responda confirmando o entendimento do relato.
      
      CONTEXTO DE DADOS ATUAL:
      ${JSON.stringify(contextData, null, 2)}
    `;

    try {
        // --- GOOGLE GEMINI (MULTIMODAL) ---
        if (config.provider === 'google') {
            const apiKey = config.keys.google;
            if (!apiKey) return "⚠️ Configure sua API Key do Google.";

            const ai = new GoogleGenAI({ apiKey });
            
            // Construção do Payload Multimodal
            const parts: any[] = [];
            
            // 1. Texto do usuário
            if (userMessage) parts.push({ text: userMessage });
            
            // 2. Anexos (Imagens, Áudio, PDF)
            attachments.forEach(att => {
                if (att.base64) {
                    parts.push({
                        inlineData: {
                            mimeType: att.mimeType,
                            data: att.base64
                        }
                    });
                }
            });

            // Se não houver nada, aborta
            if (parts.length === 0) return "Por favor, envie um texto, áudio ou imagem.";

            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview', // Suporta áudio e imagem nativamente
                contents: { parts },
                config: {
                    systemInstruction: chatSystemPrompt,
                    temperature: 0.6,
                }
            });
            return response.text || "Não consegui processar a resposta.";
        }

        // --- OPENAI (GPT-4o) ---
        if (config.provider === 'openai') {
            const apiKey = config.keys.openai;
            if (!apiKey) return "⚠️ Chave OpenAI ausente.";

            // OpenAI Vision payload builder (simplificado para imagem)
            const messages: any[] = [{ role: "system", content: chatSystemPrompt }];
            
            const contentParts: any[] = [{ type: "text", text: userMessage }];
            
            attachments.forEach(att => {
                if (att.type === 'image' && att.base64) {
                    contentParts.push({
                        type: "image_url",
                        image_url: { url: `data:${att.mimeType};base64,${att.base64}` }
                    });
                }
                // OpenAI não aceita áudio direto no endpoint de chat completion padrão (precisa de Whisper)
                // Ignorando áudio para OpenAI neste fallback simples
            });

            messages.push({ role: "user", content: contentParts });

            const res = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4o-mini", 
                    messages: messages,
                    temperature: 0.6
                })
            });

            if (!res.ok) {
                const errJson = await res.json().catch(() => ({}));
                throw new Error(errJson.error?.message || `Erro HTTP ${res.status}`);
            }

            const json = await res.json();
            return json.choices?.[0]?.message?.content || "Sem resposta.";
        }

        return `Provedor ${config.provider} não suporta multimodalidade neste sistema. Use o Google Gemini.`;

    } catch (error: any) {
        return this.handleError(error);
    }
  },

  handleError(error: any): string {
      const msg = error.message?.toLowerCase() || '';
      
      if (msg.includes('429') || msg.includes('quota')) {
          return "⚠️ Limite de cota excedido na IA. Verifique seu plano.";
      }
      if (msg.includes('401') || msg.includes('key')) {
          return "⚠️ Chave de API inválida.";
      }
      return `Erro na Inteligência: ${error.message}`;
  },

  getSystemPrompt(type: string): string {
    const basePrompt = `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros.`;
    // ... (mantido igual)
    return basePrompt;
  }
};
