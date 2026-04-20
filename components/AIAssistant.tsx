
import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, X, Bot, User, ChevronDown, ChevronUp, Loader2, Minimize2 } from 'lucide-react';
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
    if (isOpen && !isMinimized) {
        scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async () => {
    if (!query.trim() || isLoading) return;

    const userMsg = query;
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setQuery('');
    setIsLoading(true);

    try {
        const contextSnapshot = {
            usuario: user?.email,
            data: new Date().toLocaleDateString(),
            origem: 'Chat Flutuante Rápido'
        };

        const response = await aiService.chatWithContext(userMsg, contextSnapshot);
        
        setMessages(prev => [...prev, { role: 'ai', text: response }]);
    } catch (error: any) {
        setMessages(prev => [...prev, { role: 'ai', text: `Erro: ${error.message || 'Falha na comunicação com a IA.'}` }]);
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div 
        className={`fixed bottom-6 right-6 z-50 flex flex-col transition-all duration-500 ease-in-out print:hidden overflow-hidden bg-white shadow-2xl border-slate-200
            ${!isOpen 
                ? 'w-14 h-14 rounded-full border-none cursor-pointer hover:scale-110 hover:bg-blue-700 bg-blue-600' 
                : isMinimized 
                    ? 'w-96 h-14 rounded-2xl border' 
                    : 'w-96 h-[500px] rounded-2xl border'
            }
        `}
    >
      {!isOpen ? (
          <div 
            className="w-full h-full flex items-center justify-center text-white" 
            onClick={() => setIsOpen(true)}
            title="IA Assistente"
          >
              <Sparkles size={24} />
          </div>
      ) : (
          <>
              {/* HEADER DO CHAT */}
              <div 
                className="p-4 bg-slate-900 text-white flex justify-between items-center cursor-pointer shrink-0" 
                onClick={() => setIsMinimized(!isMinimized)}
              >
                  <div className="flex items-center gap-2">
                      <Sparkles size={18} className="text-blue-400" />
                      <h3 className="font-bold">AutoClaims Insight AI</h3>
                  </div>
                  <div className="flex items-center gap-3">
                      <button 
                          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                          className="hover:text-blue-400 transition-colors"
                          title="Modo Foco (Flutuante)"
                      >
                          <Minimize2 size={16} />
                      </button>
                      <button 
                          onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} 
                          className="hover:text-blue-400 transition-colors"
                          title={isMinimized ? 'Expandir' : 'Minimizar'}
                      >
                          {isMinimized ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                      </button>
                      <button 
                          onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} 
                          className="hover:text-red-400 transition-colors ml-1"
                          title="Fechar"
                      >
                          <X size={18} />
                      </button>
                  </div>
              </div>

              {/* CONTEÚDO DO CHAT (Com opacity e transição) */}
              <div className={`flex-1 flex flex-col transition-opacity duration-300 ${isMinimized ? 'opacity-0 pointer-events-none' : 'opacity-100'} overflow-hidden`}>
                  <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-slate-50 relative">
                      {messages.map((m, idx) => (
                      <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                          <div className={`max-w-[85%] p-4 shadow-sm text-sm leading-relaxed ${
                          m.role === 'user' 
                              ? 'bg-blue-600 text-white rounded-[24px] rounded-tr-sm rounded-br-[18px]' 
                              : 'bg-white text-slate-700 border border-slate-200 rounded-[24px] rounded-tl-sm rounded-bl-[18px]'
                          }`}>
                          <div className={`flex items-center gap-2 mb-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {m.role === 'ai' ? <Bot size={14} className="text-blue-500" /> : <User size={14} className="text-blue-200" />}
                              <span className={`text-[9px] font-black uppercase tracking-widest ${m.role === 'user' ? 'text-blue-200' : 'text-slate-400'}`}>
                                {m.role === 'ai' ? 'Sistema AI' : 'Você'}
                              </span>
                          </div>
                          <p className="whitespace-pre-wrap">{m.text}</p>
                          </div>
                      </div>
                      ))}
                      {isLoading && (
                      <div className="flex justify-start animate-in fade-in">
                          <div className="bg-white p-4 rounded-[24px] rounded-tl-sm border border-slate-200 shadow-sm flex items-center gap-3">
                              <div className="flex space-x-1">
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                                  <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce"></div>
                              </div>
                          <span className="text-xs text-slate-400 font-bold ml-1">Processando...</span>
                          </div>
                      </div>
                      )}
                      <div ref={messagesEndRef} />
                  </div>

                  <div className="p-4 border-t border-slate-200 bg-white shrink-0">
                      <div className="flex gap-2">
                      <input 
                          type="text" 
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                          placeholder="Pergunte sobre custos, prazos..."
                          className="flex-1 bg-slate-100 border-none rounded-2xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                          autoFocus={isOpen && !isMinimized}
                      />
                      <button 
                          onClick={handleSend}
                          disabled={isLoading}
                          className="bg-blue-600 text-white p-3 rounded-2xl hover:bg-blue-700 transition-colors disabled:opacity-50 shadow-lg shadow-blue-600/20 active:scale-95"
                      >
                          <Send size={18} className={query.trim() ? "translate-x-0.5" : ""} />
                      </button>
                      </div>
                  </div>
              </div>
          </>
      )}
    </div>
  );
};

export default AIAssistant;
