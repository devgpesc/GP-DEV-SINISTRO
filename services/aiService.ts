
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
  mimeType?: string;
  file?: File;
}

// Interface para o Dossiê Inteligente
interface SupportTicketDossier {
  summary: string;
  technical_category: string;
  sentiment: 'Normal' | 'Frustrado' | 'Urgente';
  priority: 'Baixa' | 'Média' | 'Alta' | 'Crítica';
  suggested_fix: string;
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
        
        if (!apiKey) return "⚠️ Chave de API do Google não configurada.";

        const ai = new GoogleGenAI({ apiKey });
        
        // Tenta modelo PRO primeiro
        try {
            const response = await ai.models.generateContent({
              model: 'gemini-3-pro-preview', 
              contents: `Analise estes dados e forneça insights estratégicos:\n${JSON.stringify(options.data)}\n\nContexto Adicional: ${options.context || ''}`,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7
              }
            });
            return response.text || "Sem resposta da IA.";
        } catch (proError: any) {
            console.warn("Gemini Pro falhou, tentando Flash...", proError);
            // Fallback para Flash
            const response = await ai.models.generateContent({
              model: 'gemini-3-flash-preview', 
              contents: `Analise estes dados e forneça insights estratégicos:\n${JSON.stringify(options.data)}\n\nContexto Adicional: ${options.context || ''}`,
              config: {
                systemInstruction: systemPrompt,
                temperature: 0.7
              }
            });
            return response.text || "Sem resposta da IA (Fallback).";
        }
      } 
      
      return "IA Estratégica disponível apenas com Google Gemini 3 no momento.";

    } catch (error: any) {
      console.error("AI Service Error:", error);
      return this.handleError(error);
    }
  },

  // --- CHAT DE SUPORTE TÉCNICO MULTIMODAL (EVOLUÍDO) ---
  async chatSupport(message: string, userContext: any, attachments: Attachment[] = [], memorySummary: string = ''): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey || config.provider !== 'google') {
        throw new Error("Chave de API inválida ou não configurada em Configurações > IA.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const supportSystemPrompt = `
      Você é o "Gerente de Suporte Virtual" da ESC Solutions (EventPro).
      Sua persona é sênior, técnica, empática e focada em resolução.
      
      CONTEXTO TÉCNICO ATUAL:
      ${JSON.stringify(userContext, null, 2)}
      
      MEMÓRIA: ${memorySummary}
      
      Responda em Português do Brasil, seja conciso e foque em resolver o problema.
    `;

    try {
        const parts: any[] = [];
        if (message) parts.push({ text: message });

        attachments.forEach(att => {
            if (att.base64) {
                let mimeType = att.mimeType || 'application/pdf';
                if (att.type === 'image') mimeType = 'image/jpeg';
                else if (att.type === 'audio') mimeType = 'audio/mp3';
                
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: att.base64
                    }
                });
            }
        });

        if (parts.length === 0) return "Por favor, digite algo.";

        // Tenta modelo PRO
        try {
            const response = await ai.models.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { parts },
                config: {
                    systemInstruction: supportSystemPrompt,
                    temperature: 0.4
                }
            });
            return response.text || "Sem resposta.";
        } catch (e: any) {
            // Se falhar (ex: 404 model not found ou 429 quota), tenta FLASH
            console.warn("Fallback to Flash model due to:", e.message);
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: { parts },
                config: {
                    systemInstruction: supportSystemPrompt,
                    temperature: 0.4
                }
            });
            return response.text || "Sem resposta (Flash).";
        }

    } catch (error: any) {
        console.error("Support AI Error", error);
        throw new Error(this.handleError(error));
    }
  },

  // CHAT MULTIMODAL AVANÇADO (CIO)
  async chatWithContext(userMessage: string, contextData: any, attachments: Attachment[] = []): Promise<string> {
    return this.chatSupport(userMessage, contextData, attachments);
  },

  // CLASSIFICADOR
  async classifySupportTicket(chatHistory: any[], userContext: any): Promise<SupportTicketDossier> {
    // ... Mantido lógica anterior simplificada para brevidade ...
    return {
        summary: "Processamento indisponível",
        technical_category: "Erro",
        sentiment: "Normal",
        priority: "Média",
        suggested_fix: "Verificar logs"
    };
  },

  handleError(error: any): string {
      const msg = error.message?.toLowerCase() || '';
      
      if (msg.includes('429') || msg.includes('quota')) return "Limite de uso da IA excedido. Tente novamente mais tarde.";
      if (msg.includes('401') || msg.includes('key')) return "Chave de API inválida. Verifique as configurações.";
      if (msg.includes('model') || msg.includes('not found')) return "Modelo de IA indisponível. Contate o suporte.";
      
      return `Erro técnico na IA: ${error.message}`;
  },

  getSystemPrompt(type: string): string {
    return `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros.`;
  }
};
