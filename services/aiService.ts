
import { supabase } from './supabaseClient';
import { llmService } from './llmService';
import { LLMProvider } from '../types';

/**
 * AI Service for EventsCar (Unified Gateway)
 * Chamadas de IA via backend — chaves ficam no servidor (Vercel).
 */

interface AIAnalysisOptions {
  data: unknown;
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
      };
    } catch {
      return {
        provider: 'google' as LLMProvider,
        model: 'gemini-3-pro-preview',
      };
    }
  },

  async generateStrategicInsight(options: AIAnalysisOptions): Promise<string> {
    const config = await this.getConfig();
    const systemPrompt = `Você é um Diretor Executivo (CFO/COO) de uma empresa de gestão de frotas e seguros (EventsCar).
    Analise os dados financeiros e operacionais fornecidos.
    Foque em: Redução de custos (savings), eficiência de SLA (tempo de sinistro) e performance de fornecedores.
    Responda em Português do Brasil de forma executiva e direta.`;

    try {
      return await llmService.generateText({
        provider: config.provider,
        model: config.model,
        systemInstruction: systemPrompt,
        prompt: `Dados para análise:\n${JSON.stringify(options.data)}\n\nContexto: ${options.context || ''}`,
        temperature: 0.7,
      });
    } catch (error) {
      console.error('AI Insight Error:', error);
      return 'Não foi possível gerar a análise. Verifique a configuração da API no servidor.';
    }
  },

  async chatSupport(
    message: string,
    userContext: unknown,
    attachments: Attachment[] = [],
    memorySummary: string = '',
  ): Promise<string> {
    const config = await this.getConfig();

    const supportSystemPrompt = `
      Você é o "Gerente de Suporte Virtual" do EventsCar, produto do Grupo Esc Sistemas.
      Sua persona é sênior, técnica, empática e focada em resolução eficiente.

      IMPORTANTE - CONTEXTO DO SISTEMA:
      Este é um sistema SaaS de GESTÃO DE SINISTROS AUTOMOTIVOS (Seguros, Frotas, Oficinas).
      ATENÇÃO: NÃO é uma plataforma de eventos sociais, festas, shows ou venda de ingressos.
      Quando o usuário falar "Evento", ele se refere a um SINISTRO VEICULAR (Colisão, Roubo, Pane, etc).

      CONTEXTO TÉCNICO DO USUÁRIO ATUAL:
      ${JSON.stringify(userContext, null, 2)}

      MEMÓRIA DA CONVERSA: ${memorySummary}

      Responda em Português do Brasil.
    `;

    const attachmentNote =
      attachments.length > 0
        ? `\n[O usuário enviou ${attachments.length} anexo(s); descreva orientações gerais se não puder analisar o arquivo.]`
        : '';

    if (!message && attachments.length === 0) {
      return 'Como posso ajudar com seus processos de sinistro hoje?';
    }

    try {
      return await llmService.generateText({
        provider: config.provider,
        model: config.model,
        systemInstruction: supportSystemPrompt,
        prompt: `${message || 'Analise o contexto e ajude o usuário.'}${attachmentNote}`,
        temperature: 0.4,
      });
    } catch (error) {
      console.error('Support AI Fatal Error', error);
      return 'Desculpe, estou com dificuldades técnicas de conexão no momento. Tente novamente em alguns segundos.';
    }
  },

  async chatWithContext(userMessage: string, contextData: unknown, attachments: Attachment[] = []): Promise<string> {
    return this.chatSupport(userMessage, contextData, attachments);
  },

  async classifySupportTicket(_chatHistory: unknown[], _userContext: unknown): Promise<SupportTicketDossier> {
    return {
      summary: 'Usuário reportou problemas técnicos ou dúvidas operacionais.',
      technical_category: 'Suporte Geral',
      sentiment: 'Normal',
      priority: 'Média',
      suggested_fix: 'Verificar logs do sistema e orientar usuário conforme base de conhecimento.',
    };
  },
};
