import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, X, Send, LifeBuoy, Loader2, 
  ChevronDown, ExternalLink, AlertTriangle, CheckCircle2, User
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/aiService';
import { useLocation } from 'react-router-dom';

const SupportWidget: React.FC = () => {
  const { user, currentTenant, profile } = useAuth();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [messages, setMessages] = useState<any[]>([
    { 
      id: 'welcome', 
      role: 'agent', 
      text: 'Olá! Sou o suporte virtual da ESC Solutions. Posso ajudar com dúvidas de uso ou problemas técnicos. Como posso ajudar?' 
    }
  ]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: 'user', text: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Contexto Técnico para a IA de Suporte
      const context = {
        tenant: currentTenant?.name || 'Não identificado',
        plan: currentTenant?.saas_plans?.name || 'Free',
        user: profile?.full_name || user?.email,
        screen: location.pathname,
        timestamp: new Date().toLocaleString()
      };

      const responseText = await aiService.chatSupport(userMsg.text, context);
      
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'agent', 
        text: responseText 
      }]);

    } catch (error) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'agent', 
        text: 'Desculpe, estou com dificuldade de conexão. Por favor, tente novamente ou use o botão de WhatsApp acima.' 
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleEscalateToWhatsApp = () => {
    // Monta a mensagem pré-formatada para o WhatsApp
    const lastMsg = messages[messages.length - 1]?.text || 'Solicitação de suporte';
    
    const text = `
🚨 *SUPORTE ESC SOLUTIONS - NOVO TICKET*

🏢 *Cliente:* ${currentTenant?.name || 'N/A'}
💎 *Plano:* ${currentTenant?.saas_plans?.name || 'N/A'}
👤 *Usuário:* ${profile?.full_name || user?.email}
📍 *Tela:* ${location.pathname}

⚠️ *Relato:* ${messages.filter(m => m.role === 'user').slice(-1)[0]?.text || 'N/A'}
🤖 *Última resposta IA:* ${lastMsg.substring(0, 50)}...

_Enviado via EventPro Portal_
    `.trim();

    const encodedText = encodeURIComponent(text);
    const waNumber = '5562998464374'; // Número da ESC Solutions
    
    window.open(`https://wa.me/${waNumber}?text=${encodedText}`, '_blank');
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-[90] animate-in zoom-in"
        title="Suporte ESC Solutions"
      >
        <LifeBuoy size={28} />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    );
  }

  return (
    <div className={`fixed bottom-6 right-6 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[90] overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[600px] max-h-[80vh]'}`}>
      
      {/* Header */}
      <div className="bg-[#075E54] p-4 flex justify-between items-center text-white shrink-0">
        <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setIsMinimized(!isMinimized)}>
          <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md">
            <LifeBuoy size={20} />
          </div>
          <div>
            <h3 className="font-bold text-sm leading-tight">Suporte ESC Solutions</h3>
            <p className="text-[10px] text-green-100 flex items-center gap-1">
              <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse"></span> Online agora
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-white/10 rounded"><ChevronDown size={18}/></button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded"><X size={18}/></button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Top Warning / Escalate */}
          <div className="bg-green-50 p-3 border-b border-green-100 flex justify-between items-center px-4">
             <span className="text-[10px] font-bold text-green-800 uppercase">Precisa de humano?</span>
             <button onClick={handleEscalateToWhatsApp} className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase hover:bg-[#128C7E] transition-colors shadow-sm">
                <MessageCircle size={12} fill="white" /> Falar no WhatsApp
             </button>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-4 bg-[#E5DDD5] space-y-4 relative">
            <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")'}}></div>
            
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative z-10`}>
                {msg.role === 'agent' && (
                   <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 shrink-0 text-[#075E54]">
                      <LifeBuoy size={14}/>
                   </div>
                )}
                <div className={`max-w-[85%] p-3 rounded-xl text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user' 
                    ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-none' 
                    : 'bg-white text-slate-800 rounded-tl-none'
                }`}>
                  {msg.text}
                  <div className={`text-[9px] text-right mt-1 opacity-50 font-bold ${msg.role === 'user' ? 'text-green-900' : 'text-slate-500'}`}>
                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                  </div>
                </div>
              </div>
            ))}
            {loading && (
               <div className="flex justify-start relative z-10">
                  <div className="bg-white p-3 rounded-xl rounded-tl-none shadow-sm flex items-center gap-2">
                     <Loader2 size={14} className="animate-spin text-[#075E54]"/>
                     <span className="text-xs text-slate-500">ESC Support está digitando...</span>
                  </div>
               </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-3 bg-[#F0F0F0] border-t border-slate-200">
            <div className="flex gap-2 bg-white p-1 rounded-3xl border border-white shadow-sm focus-within:ring-2 focus-within:ring-[#25D366]/50 transition-all">
              <input 
                className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-sm text-slate-800 placeholder:text-slate-400"
                placeholder="Digite sua dúvida..."
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
              />
              <button 
                onClick={handleSend}
                disabled={loading || !input.trim()}
                className="w-9 h-9 bg-[#075E54] text-white rounded-full flex items-center justify-center hover:bg-[#128C7E] disabled:opacity-50 disabled:bg-slate-400 transition-all"
              >
                {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} className="ml-0.5"/>}
              </button>
            </div>
            <div className="text-center mt-2">
               <p className="text-[9px] text-slate-400">Ambiente monitorado pela ESC Solutions.</p>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SupportWidget;