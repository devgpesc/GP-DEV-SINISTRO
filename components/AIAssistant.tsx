
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { aiService } from '../services/aiService';
import { useAuth } from '../context/AuthContext';

const AIAssistant: React.FC = () => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<{ role: 'ai' | 'user'; text: string }[]>([
    { role: 'ai', text: 'Olá! Sou seu assistente estratégico. Como posso ajudar com seus sinistros e compras hoje?' }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;

    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setIsLoading(true);

    try {
        // Dados de contexto simplificados para a análise rápida
        const contextSnapshot = {
            usuario: user?.email,
            data: new Date().toLocaleDateString(),
            origem: 'Chat Flutuante Rápido'
        };

        // Usa o serviço unificado que lê as configurações do banco (OpenAI/Google)
        const response = await aiService.chatWithContext(userMsg, contextSnapshot);
        
        setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error: any) {
        setMessages(prev => [...prev, { role: 'ai', text: `Erro: ${error.message || 'Falha na comunicação com a IA.'}` }]);
    } finally {
        setIsLoading(false);
    }
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-blue-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:bg-blue-700 transition-all z-50 hover:scale-110 print:hidden"
        title="IA Assistente"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden flex flex-col transition-all print:hidden ${isMinimized ? 'h-14' : 'h-[500px]'}`}>
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="flex items-center gap-2">
          <Sparkles size={18} className="text-blue-400" />
          <h3 className="font-bold">AutoClaims Insight AI</h3>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="hover:text-blue-400">
            {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
          </button>
          <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="hover:text-red-400">
            <X size={18} />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((m, idx) => (
              <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm shadow-sm ${
                  m.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-br-none' 
                    : 'bg-white text-slate-700 border border-slate-200 rounded-bl-none'
                }`}>
                  <div className="flex items-center gap-2 mb-1">
                    {m.role === 'ai' ? <Bot size={14} className="text-blue-500" /> : <User size={14} />}
                    <span className="text-[10px] font-bold uppercase">{m.role === 'ai' ? 'Sistema AI' : 'Você'}</span>
                  </div>
                  <p className="whitespace-pre-wrap leading-relaxed">{m.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl border border-slate-200 animate-pulse flex items-center gap-2">
                  <Loader2 size={16} className="animate-spin text-blue-600"/>
                  <span className="text-xs text-slate-400 font-bold">Digitando...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="p-4 border-t border-slate-200 bg-white">
            <div className="flex gap-2">
              <input 
                type="text" 
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Pergunte sobre custos, prazos..."
                className="flex-1 bg-slate-100 border-none rounded-lg px-4 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoFocus
              />
              <button 
                onClick={handleSend}
                disabled={isLoading}
                className="bg-blue-600 text-white p-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                <Send size={18} />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default AIAssistant;
