
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
  mimeType?: string; // Alterado para opcional para compatibilidade
  file?: File;
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

  // --- NOVO: CHAT DE SUPORTE TÉCNICO MULTIMODAL ---
  async chatSupport(message: string, userContext: any, attachments: Attachment[] = []): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey || config.provider !== 'google') {
        return "Olá. Para suporte avançado com envio de arquivos, por favor configure a chave do Google Gemini nas configurações.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const supportSystemPrompt = `
      Você é o Agente de Suporte Técnico Nível 1 da ESC Solutions, criadora do software EventPro.
      Sua missão é ajudar o usuário a resolver problemas técnicos ou dúvidas operacionais.
      
      CONTEXTO ATUAL DO USUÁRIO:
      ${JSON.stringify(userContext, null, 2)}
      
      CAPACIDADES MULTIMODAIS:
      - Você pode VER imagens (prints de erro, fotos de veículos).
      - Você pode OUVIR áudios (descrições de problemas).
      - Você pode VER vídeos curtos enviados pelo usuário.
      
      DIRETRIZES:
      1. Se o usuário enviar uma IMAGEM de erro, analise o texto da imagem e sugira a solução.
      2. Se o usuário enviar um ÁUDIO, transcreva mentalmente e responda à dúvida.
      3. Se o usuário enviar um VÍDEO, descreva o que vê e diagnostique.
      4. Seja educado, técnico mas acessível.
      5. Se o problema parecer complexo ou se você não conseguir resolver, sugira clicar no botão "WhatsApp" acima.
      6. Responda em Português do Brasil.
    `;

    try {
        // Constrói payload multimodal
        const parts: any[] = [];
        
        if (message) parts.push({ text: message });

        attachments.forEach(att => {
            if (att.base64) {
                // Mapeia tipos genéricos para MIME types suportados pelo Gemini
                let mimeType = att.mimeType;
                if (!mimeType) {
                    if (att.type === 'image') mimeType = 'image/jpeg';
                    else if (att.type === 'audio') mimeType = 'audio/mp3'; // Gemini aceita mp3/wav/aac/flac etc.
                    else if (att.type === 'video') mimeType = 'video/mp4';
                    else mimeType = 'application/pdf'; // Default fallback
                }
                
                // Correção para WebM (gravação do navegador) se necessário
                if (att.file?.type) mimeType = att.file.type;

                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: att.base64
                    }
                });
            }
        });

        if (parts.length === 0) return "Por favor, digite algo ou envie um arquivo.";

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-preview', // Usar modelo Pro para melhor visão/áudio
            contents: { parts },
            config: {
                systemInstruction: supportSystemPrompt,
                temperature: 0.5,
            }
        });
        return response.text || "Desculpe, não entendi. Pode reformular?";
    } catch (error: any) {
        console.error("Support AI Error", error);
        return "Estou analisando seu arquivo mas encontrei uma dificuldade técnica. Tente enviar uma imagem ou texto.";
    }
  },

  // CHAT MULTIMODAL AVANÇADO (CIO - Mantido para compatibilidade)
  async chatWithContext(userMessage: string, contextData: any, attachments: Attachment[] = []): Promise<string> {
    return this.chatSupport(userMessage, contextData, attachments);
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
    return basePrompt;
  }
};
