
import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Bot, User, Loader2, RefreshCw } from 'lucide-react';
import { aiService } from '../services/aiService';
import { supabase } from '../services/supabaseClient';

interface AIChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  role: 'user' | 'ai';
  text: string;
  time: string;
}

const AIChatWindow: React.FC<AIChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'ai', text: 'Olá! Sou a Inteligência Visionária do AutoClaims. Analisei seus dados em tempo real. Como posso ajudar a otimizar sua operação hoje?', time: new Date().toLocaleTimeString() }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [dataContext, setDataContext] = useState<any>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Carregar contexto de dados ao abrir
  useEffect(() => {
    if (isOpen) {
        loadContextData();
    }
  }, [isOpen]);

  // Scroll automático
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadContextData = async () => {
      setContextLoading(true);
      try {
          // Busca paralela de dados para o contexto da IA
          const [eventsRes, ordersRes, suppliersRes] = await Promise.all([
              supabase.from('events').select('status, priority, type'),
              supabase.from('purchase_orders').select('total, status, created_at'),
              supabase.from('suppliers').select('id, rating, status')
          ]);

          const events = eventsRes.data || [];
          const orders = ordersRes.data || [];
          const suppliers = suppliersRes.data || [];

          // Processamento leve para não estourar tokens
          const snapshot = {
              resumo_eventos: {
                  total: events.length,
                  abertos: events.filter(e => e.status !== 'Concluído').length,
                  criticos: events.filter(e => e.priority === 'Urgente').length,
                  status_dist: events.reduce((acc: any, e) => { acc[e.status] = (acc[e.status]||0)+1; return acc; }, {})
              },
              resumo_financeiro: {
                  total_gasto_geral: orders.reduce((acc, o) => acc + (o.total || 0), 0),
                  pendente_aprovacao: orders.filter(o => o.status === 'Gerada').length,
                  volume_compras: orders.length
              },
              resumo_fornecedores: {
                  total_ativos: suppliers.filter(s => s.status === 'Ativo').length,
                  media_rating: suppliers.length > 0 ? (suppliers.reduce((acc, s) => acc + (s.rating||0), 0) / suppliers.length).toFixed(1) : 0
              }
          };
          
          setDataContext(snapshot);
      } catch (e) {
          console.error("Erro ao carregar contexto IA", e);
      } finally {
          setContextLoading(false);
      }
  };

  const handleSend = async () => {
      if (!input.trim() || loading) return;
      
      const userMsg = input;
      setInput('');
      
      setMessages(prev => [...prev, { role: 'user', text: userMsg, time: new Date().toLocaleTimeString() }]);
      setLoading(true);

      try {
          // Envia a mensagem + o contexto atualizado
          const response = await aiService.chatWithContext(userMsg, dataContext);
          setMessages(prev => [...prev, { role: 'ai', text: response, time: new Date().toLocaleTimeString() }]);
      } catch (error) {
          setMessages(prev => [...prev, { role: 'ai', text: "Desculpe, tive um problema ao processar. Tente novamente.", time: new Date().toLocaleTimeString() }]);
      } finally {
          setLoading(false);
      }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100]" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-full md:w-[450px] bg-white shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border-l border-slate-100">
        
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex justify-between items-center shadow-md">
            <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/30">
                    <Sparkles size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="font-black text-lg tracking-tight">IA Visionária</h3>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-widest flex items-center gap-1">
                        {contextLoading ? <><Loader2 size={10} className="animate-spin"/> Atualizando dados...</> : 'Conectada aos dados'}
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={20}/></button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50">
            {messages.map((msg, idx) => (
                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-t-2xl rounded-bl-2xl' : 'bg-white border border-slate-200 text-slate-700 rounded-t-2xl rounded-br-2xl'} p-4 shadow-sm relative group`}>
                        <div className="flex items-center gap-2 mb-1.5 opacity-80">
                            {msg.role === 'ai' ? <Bot size={14} className="text-indigo-500"/> : <User size={14}/>}
                            <span className="text-[10px] font-bold uppercase">{msg.role === 'ai' ? 'Assistente' : 'Você'}</span>
                        </div>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap font-medium">
                            {msg.text}
                        </div>
                        <span className="text-[9px] opacity-50 absolute bottom-2 right-3">{msg.time}</span>
                    </div>
                </div>
            ))}
            {loading && (
                <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 p-4 rounded-t-2xl rounded-br-2xl shadow-sm flex items-center gap-2">
                        <Loader2 size={16} className="animate-spin text-indigo-600"/>
                        <span className="text-xs font-bold text-slate-500 animate-pulse">Analisando dados...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-white border-t border-slate-100">
            <div className="relative">
                <input 
                    className="w-full pl-4 pr-12 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all font-medium text-sm text-slate-700 placeholder:text-slate-400"
                    placeholder="Pergunte sobre custos, prazos ou eficiência..."
                    value={input}
                    onChange={e => setInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                    autoFocus
                />
                <button 
                    onClick={handleSend}
                    disabled={!input.trim() || loading}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-lg shadow-indigo-600/20"
                >
                    <Send size={18} />
                </button>
            </div>
            <div className="mt-3 flex justify-center gap-2">
               <button onClick={() => { setInput("Qual o total gasto este mês e onde posso economizar?"); handleSend(); }} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-bold">💰 Gastos & Economia</button>
               <button onClick={() => { setInput("Quais eventos estão parados há mais tempo?"); handleSend(); }} className="text-[10px] bg-slate-100 hover:bg-slate-200 text-slate-600 px-3 py-1.5 rounded-lg transition-colors font-bold">⚠️ Gargalos Operacionais</button>
            </div>
        </div>
      </div>
    </>
  );
};

export default AIChatWindow;
