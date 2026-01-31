
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
    const systemPrompt = `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros (AutoClaims Pro).
    Analise os dados financeiros e operacionais fornecidos.
    Foque em: Redução de custos (savings), eficiência de SLA (tempo de sinistro) e performance de fornecedores.
    Responda em Português do Brasil de forma executiva e direta.`;
    
    try {
      if (config.provider === 'google') {
        const apiKey = config.keys.google;
        if (!apiKey) return "⚠️ Chave de API do Google não configurada.";

        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: config.model || 'gemini-3-pro-preview',
            contents: `Dados para análise:\n${JSON.stringify(options.data)}\n\nContexto: ${options.context || ''}`,
            config: {
                systemInstruction: systemPrompt,
                temperature: 0.7
            }
        });
        return response.text || "Sem análise disponível.";
      }
      return "Provedor de IA não suportado para esta função.";
    } catch (error: any) {
      console.error("AI Insight Error:", error);
      return "Não foi possível gerar a análise no momento.";
    }
  },

  // --- CHAT DE SUPORTE TÉCNICO ---
  async chatSupport(message: string, userContext: any, attachments: Attachment[] = [], memorySummary: string = ''): Promise<string> {
    const config = await this.getConfig();
    const apiKey = config.keys.google;
    
    if (!apiKey) return "⚠️ Erro: Chave de API não configurada. Contate o administrador.";

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
                // Fallback simples para mimeType se vier incompleto
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

        const response = await ai.models.generateContent({
            model: config.model || 'gemini-3-pro-preview',
            contents: { parts },
            config: {
                systemInstruction: supportSystemPrompt,
                temperature: 0.4 // Temperatura baixa para ser mais preciso nas instruções
            }
        });
        return response.text || "Sem resposta.";

    } catch (error: any) {
        console.error("Support AI Error", error);
        return "Desculpe, estou com dificuldades de conexão com o servidor de inteligência no momento.";
    }
  },

  async chatWithContext(userMessage: string, contextData: any, attachments: Attachment[] = []): Promise<string> {
    return this.chatSupport(userMessage, contextData, attachments);
  },

  async classifySupportTicket(chatHistory: any[], userContext: any): Promise<SupportTicketDossier> {
     // Mock ou implementação futura para classificar tickets automaticamente
     return {
        summary: "Ticket gerado via chat",
        technical_category: "Dúvida Operacional",
        sentiment: "Normal",
        priority: "Média",
        suggested_fix: "Verificar base de conhecimento"
    };
  }
};
