
import { GoogleGenAI } from "@google/genai";
import { supabase } from './supabaseClient';
import { LLMProvider } from '../types';

/**
 * AI Service for AutoClaims Pro (Unified Gateway)
 * Centraliza a inteligência do sistema, gerenciando contexto e prompts.
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
  url?: string;
  name?: string;
}

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
        const { data } = await supabase.from('saas_settings').select('*').limit(1).maybeSingle();
        // Fallback para variáveis de ambiente caso o banco esteja vazio ou sem chaves
        const googleKey = data?.gemini_key && data.gemini_key.length > 10 
            ? data.gemini_key 
            : process.env.API_KEY;

        return {
          provider: (data?.ai_provider || 'google') as LLMProvider,
          model: data?.ai_model || 'gemini-3-pro-preview',
          keys: {
            google: googleKey, 
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
    const systemPrompt = `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros (AutoClaims Pro).
    Analise os dados financeiros e operacionais fornecidos.
    Foque em: Redução de custos (savings), eficiência de SLA (tempo de sinistro) e performance de fornecedores.
    Responda em Português do Brasil de forma executiva e direta.`;
    
    try {
      if (config.provider === 'google') {
        const apiKey = config.keys.google;
        if (!apiKey) return "⚠️ Chave de API do Google não configurada. Vá em Configurações > Inteligência Artificial.";

        const ai = new GoogleGenAI({ apiKey });
        
        // Tentativa Modelo Pro
        try {
            const response = await ai.models.generateContent({
                model: config.model || 'gemini-3-pro-preview',
                contents: `Dados para análise:\n${JSON.stringify(options.data)}\n\nContexto: ${options.context || ''}`,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7
                }
            });
            return response.text || "Sem análise disponível.";
        } catch (proError: any) {
            console.warn("Fallback to Flash model (Insight):", proError.message);
            // Fallback Modelo Flash
            const response = await ai.models.generateContent({
                model: 'gemini-3-flash-preview',
                contents: `Dados para análise:\n${JSON.stringify(options.data)}\n\nContexto: ${options.context || ''}`,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7
                }
            });
            return response.text || "Análise gerada (modo rápido).";
        }
      }
      return "Provedor de IA não suportado para esta função.";
    } catch (error: any) {
      console.error("AI Insight Error:", error);
      return "Não foi possível gerar a análise. Verifique sua chave de API.";
    }
  },

  // --- CHAT DE SUPORTE TÉCNICO ---
  async chatSupport(message: string, userContext: any, attachments: Attachment[] = [], memorySummary: string = ''): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey) return "⚠️ Erro Crítico: Chave de API não configurada. Por favor, configure uma chave Gemini nas Configurações do sistema.";

    const ai = new GoogleGenAI({ apiKey });
    
    // --- DEFINIÇÃO CORRETA DO SISTEMA ---
    const supportSystemPrompt = `
      Você é o "Gerente de Suporte Virtual" da ESC Solutions (EventPro / AutoClaims).
      Sua persona é sênior, técnica, empática e focada em resolução eficiente.
      
      IMPORTANTE - CONTEXTO DO SISTEMA:
      Este é um sistema SaaS de GESTÃO DE SINISTROS AUTOMOTIVOS (Seguros, Frotas, Oficinas).
      ATENÇÃO: NÃO é uma plataforma de eventos sociais, festas, shows ou venda de ingressos.
      Quando o usuário falar "Evento", ele se refere a um SINISTRO VEICULAR (Colisão, Roubo, Pane, etc).

      BASE DE CONHECIMENTO (PROCEDIMENTOS CORRETOS):
      1. CRIAR NOVO SINISTRO (EVENTO):
         - Acesse o menu lateral "Eventos".
         - Clique no botão "Novo Sinistro" (canto superior direito).
         - Passo 1 (Vínculo): Selecione obrigatoriamente o Associado (Cliente) e depois o Veículo.
         - Passo 2 (Detalhes): O protocolo é automático. Defina o Tipo (Colisão, Furto...), Categoria e Prioridade.
         - Passo 3 (Evidências): Anexe fotos e documentos se houver.
         - Clique em "Salvar Sinistro".
      
      2. COTAÇÕES (PEÇAS/SERVIÇOS):
         - Após criar o evento, o status inicial é "Aguardando".
         - Vá ao menu "Cotações" para iniciar o processo de compra de peças para o sinistro.
         - Lance os itens e selecione fornecedores para enviar a RFQ.
      
      3. COMPRAS (ORDENS DE COMPRA - OC):
         - A aprovação da cotação gera OCs automaticamente no menu "Compras".
         - O gestor deve aprovar a OC para que ela seja enviada ao fornecedor.

      CONTEXTO TÉCNICO DO USUÁRIO ATUAL:
      ${JSON.stringify(userContext, null, 2)}
      
      MEMÓRIA DA CONVERSA: ${memorySummary}
      
      Responda em Português do Brasil. Se o usuário perguntar "como criar um evento", use o procedimento de SINISTRO acima. Nunca mencione ingressos ou local de festa.
    `;

    try {
        const parts: any[] = [];
        if (message) parts.push({ text: message });

        attachments.forEach(att => {
            if (att.base64) {
                let mimeType = att.mimeType || 'application/octet-stream';
                if (att.type === 'image' && !mimeType.includes('image')) mimeType = 'image/jpeg';
                
                parts.push({
                    inlineData: {
                        mimeType: mimeType,
                        data: att.base64
                    }
                });
            }
        });

        if (parts.length === 0) return "Como posso ajudar com seus processos de sinistro hoje?";

        // --- LÓGICA DE FALLBACK AUTOMÁTICO ---
        try {
            // Tentativa 1: Modelo Principal (Configurado ou Pro)
            const response = await ai.models.generateContent({
                model: config.model || 'gemini-3-pro-preview',
                contents: { parts },
                config: {
                    systemInstruction: supportSystemPrompt,
                    temperature: 0.4
                }
            });
            return response.text || "Sem resposta.";

        } catch (primaryError: any) {
            console.warn("Primary Model Failed. Retrying with Flash...", primaryError.message);
            
            // Tentativa 2: Modelo Flash (Mais rápido e estável)
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
        console.error("Support AI Fatal Error", error);
        
        // Mensagens de erro amigáveis para o usuário
        const msg = error.message?.toLowerCase() || '';
        if (msg.includes('401') || msg.includes('invalid') || msg.includes('key')) {
            return "❌ Erro de Autenticação: Sua chave de API (Gemini) parece inválida ou expirou. Verifique nas Configurações.";
        }
        if (msg.includes('429') || msg.includes('quota')) {
            return "⏳ Sistema sobrecarregado (Quota Excedida). Por favor, aguarde alguns instantes e tente novamente.";
        }
        if (msg.includes('model') || msg.includes('not found')) {
            return "⚠️ O modelo de IA configurado não está disponível na sua região ou conta. Tente alterar para 'gemini-2.0-flash' nas configurações.";
        }

        return "Desculpe, estou com dificuldades técnicas de conexão no momento. Tente novamente em alguns segundos.";
    }
  },

  async chatWithContext(userMessage: string, contextData: any, attachments: Attachment[] = []): Promise<string> {
    return this.chatSupport(userMessage, contextData, attachments);
  },

  async classifySupportTicket(chatHistory: any[], userContext: any): Promise<SupportTicketDossier> {
     // Mock temporário para garantir funcionalidade mesmo sem API
     return {
        summary: "Usuário reportou problemas técnicos ou dúvidas operacionais.",
        technical_category: "Suporte Geral",
        sentiment: "Normal",
        priority: "Média",
        suggested_fix: "Verificar logs do sistema e orientar usuário conforme base de conhecimento."
    };
  }
};
