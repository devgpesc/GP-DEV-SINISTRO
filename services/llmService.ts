
import { LLMProvider, LLMModel } from '../types';

/**
 * Serviço Unificado de IA (LLM Gateway)
 * Centraliza chamadas para Google, OpenAI, Anthropic e Groq.
 * As chaves ficam seguras no backend.
 */

const API_BASE = (import.meta as any).env?.VITE_API_BASE_URL || '/api';

interface GenerateOptions {
  prompt: string;
  systemInstruction?: string;
  provider?: LLMProvider;
  model?: LLMModel;
  temperature?: number;
}

export const llmService = {
  /**
   * Gera texto usando o provedor configurado.
   * Faz fallback automático se necessário (lógica pode ser expandida).
   */
  async generateText(options: GenerateOptions): Promise<string> {
    const { 
      prompt, 
      systemInstruction, 
      provider = 'google', // Default
      model = 'gemini-3-flash-preview', // Default
      temperature = 0.7 
    } = options;

    try {
      const response = await fetch(`${API_BASE}/llm/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider,
          model,
          prompt,
          systemInstruction,
          temperature
        })
      });

      if (!response.ok) {
        throw new Error(`Erro na IA: ${response.statusText}`);
      }

      const data = await response.json();
      return data.text;

    } catch (error) {
      console.error('[LLM Service Error]', error);
      return "Desculpe, serviço de inteligência indisponível no momento.";
    }
  },

  /**
   * Helper para análise de eventos com modelo mais parrudo
   */
  async analyzeEvent(eventData: any) {
    return this.generateText({
      provider: 'google',
      model: 'gemini-3-pro-preview', // Modelo de raciocínio
      systemInstruction: 'Você é um auditor sênior de seguros automotivos. Analise os dados para fraude ou inconsistência.',
      prompt: JSON.stringify(eventData)
    });
  },

  /**
   * Helper para chat rápido
   */
  async chatQuick(message: string) {
    return this.generateText({
      provider: 'google', // Ou Groq para velocidade
      model: 'gemini-3-flash-preview',
      systemInstruction: 'Assistente útil e rápido.',
      prompt: message
    });
  }
};
