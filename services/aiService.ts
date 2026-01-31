
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

  // --- NOVO: CLASSIFICADOR DE CHAMADOS (Intelligent Escalation) ---
  async classifySupportTicket(chatHistory: any[], userContext: any): Promise<SupportTicketDossier> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    // Fallback padrão se não tiver chave
    const defaultDossier: SupportTicketDossier = {
        summary: "Suporte solicitado pelo usuário.",
        technical_category: "Geral",
        sentiment: "Normal",
        priority: "Média",
        suggested_fix: "Análise humana necessária."
    };

    if (!apiKey || config.provider !== 'google') return defaultDossier;

    const ai = new GoogleGenAI({ apiKey });
    
    const classificationPrompt = `
      Analise o histórico de chat de suporte abaixo e gere um DOSSIÊ TÉCNICO para o time de engenharia/Nível 2.
      
      CONTEXTO DO USUÁRIO:
      ${JSON.stringify(userContext)}
      
      HISTÓRICO DO CHAT:
      ${JSON.stringify(chatHistory.map(m => ({ role: m.role, text: m.text })))}
      
      SAÍDA ESPERADA (JSON PURO):
      {
        "summary": "Resumo técnico de uma linha (Ex: Falha FK ao criar Veículo)",
        "technical_category": "Bug | Dúvida | Financeiro | Infraestrutura",
        "sentiment": "Normal | Frustrado | Urgente",
        "priority": "Baixa | Média | Alta | Crítica",
        "suggested_fix": "Ação sugerida para o humano (Ex: Verificar tabela vehicles)"
      }
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview', // Modelo rápido para classificação
            contents: "Gere o JSON de classificação.",
            config: {
                systemInstruction: classificationPrompt,
                responseMimeType: "application/json",
                temperature: 0.2
            }
        });
        
        const jsonText = response.text;
        if (!jsonText) return defaultDossier;
        
        return JSON.parse(jsonText) as SupportTicketDossier;
    } catch (error) {
        console.error("Erro na classificação automática:", error);
        return defaultDossier;
    }
  },

  // --- NOVO: CHAT DE SUPORTE TÉCNICO MULTIMODAL (EVOLUÍDO) ---
  async chatSupport(message: string, userContext: any, attachments: Attachment[] = [], memorySummary: string = ''): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey || config.provider !== 'google') {
        return "Olá. Para suporte avançado com envio de arquivos, por favor configure a chave do Google Gemini nas configurações.";
    }

    const ai = new GoogleGenAI({ apiKey });
    
    // Prompt Evoluído: Gerente de Suporte Virtual
    const supportSystemPrompt = `
      Você é o "Gerente de Suporte Virtual" da ESC Solutions (EventPro).
      Sua persona é sênior, técnica, empática e focada em resolução (Problem Solver).
      
      CONTEXTO TÉCNICO ATUAL:
      ${JSON.stringify(userContext, null, 2)}
      
      MEMÓRIA DE INTERAÇÕES ANTERIORES:
      ${memorySummary ? memorySummary : 'Nenhum histórico recente relevante.'}
      
      CAPACIDADES:
      - Visão Computacional (Análise de prints de erro).
      - Audição (Transcrever relatos).
      - Raciocínio de Debugging (Identificar causa raiz).
      
      DIRETRIZES DE ATENDIMENTO:
      1. **Não peça desculpas excessivas**. Foco na solução. Ex: Em vez de "Sinto muito pelo erro", use "Entendi o bloqueio, vamos contornar isso verificando X".
      2. **Identifique padrões**. Se a memória indicar erros repetidos, sugira algo diferente.
      3. **Seja Educativo**. Ensine o usuário a usar a ferramenta, não apenas dê a resposta.
      4. **Detecção de Frustração**. Se o usuário parecer irritado (caps lock, repetição), seja direto e sugira o escalonamento para WhatsApp imediatamente.
      5. **Limites**. Você não tem acesso direto ao banco de dados para alterar registros, apenas para ler configs via contexto.
      6. **Resposta**. Responda em Português do Brasil, usando formatação Markdown (negrito para botões/menus).
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
            model: 'gemini-3-pro-preview', // Usar modelo Pro para raciocínio complexo
            contents: { parts },
            config: {
                systemInstruction: supportSystemPrompt,
                temperature: 0.4, // Mais determinístico para suporte
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
