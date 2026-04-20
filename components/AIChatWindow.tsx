
import React, { useState, useEffect, useRef } from 'react';
import { 
  X, Send, Sparkles, Bot, User, Loader2, Mic, Image as ImageIcon, 
  Paperclip, StopCircle, Trash2, FileText, ChevronDown 
} from 'lucide-react';
import { aiService } from '../services/aiService';
import { supabase } from '../services/supabaseClient';

interface AIChatWindowProps {
  isOpen: boolean;
  onClose: () => void;
}

interface Message {
  id: string;
  role: 'user' | 'ai';
  text: string;
  time: string;
  attachments?: Attachment[];
}

interface Attachment {
  type: 'image' | 'audio' | 'file';
  url: string; // Base64 or Blob URL for preview
  base64?: string; // For API
  mimeType: string;
  name: string;
}

const AIChatWindow: React.FC<AIChatWindowProps> = ({ isOpen, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([
    { 
      id: 'welcome',
      role: 'ai', 
      text: 'Olá. Sou sua IA Especialista em Sinistros. Estou monitorando os processos, custos e SLAs em tempo real.\n\nVocê pode me enviar fotos de avarias, áudios de vistoria ou solicitar análises de cotações.', 
      time: new Date().toLocaleTimeString() 
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contextLoading, setContextLoading] = useState(false);
  const [dataContext, setDataContext] = useState<any>(null);
  
  // Attachments State
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
  }, [messages, loading, attachments]);

  const loadContextData = async () => {
      setContextLoading(true);
      try {
          const [eventsRes, eventsCritRes, ordersPendenteRes, suppliersRes] = await Promise.all([
              supabase.from('events').select('*', { count: 'exact', head: true }),
              supabase.from('events').select('*', { count: 'exact', head: true }).eq('priority', 'Urgente'),
              supabase.from('purchase_orders').select('*', { count: 'exact', head: true }).eq('status', 'Gerada'),
              supabase.from('suppliers').select('*', { count: 'exact', head: true }).eq('status', 'Ativo')
          ]);

          const snapshot = {
              timestamp: new Date().toISOString(),
              resumo_eventos: {
                  total: eventsRes.count || 0,
                  criticos: eventsCritRes.count || 0,
              },
              resumo_financeiro: {
                  pendente_aprovacao: ordersPendenteRes.count || 0,
              },
              resumo_fornecedores: {
                  ativos: suppliersRes.count || 0,
              }
          };
          
          setDataContext(snapshot);
      } catch (e) {
          console.error("Erro ao carregar contexto IA", e);
      } finally {
          setContextLoading(false);
      }
  };

  // --- ARQUIVOS E IMAGENS ---
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      const base64 = await convertFileToBase64(file);
      
      setAttachments(prev => [...prev, {
        type: file.type.startsWith('image/') ? 'image' : 'file',
        url: URL.createObjectURL(file),
        base64,
        mimeType: file.type,
        name: file.name
      }]);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        const result = reader.result as string;
        // Remove header data:image/png;base64,
        const base64Clean = result.split(',')[1];
        resolve(base64Clean);
      };
      reader.onerror = error => reject(error);
    });
  };

  // --- ÁUDIO ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // ou mp3/wav dependendo do suporte
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1];
            setAttachments(prev => [...prev, {
                type: 'audio',
                url: URL.createObjectURL(audioBlob),
                base64: base64String,
                mimeType: 'audio/webm', // Gemini aceita audio/webm, audio/mp3, etc.
                name: 'Audio Note'
            }]);
        };
        setIsRecording(false);
        setRecordingTime(0);
      };

      mediaRecorder.start();
      setIsRecording(true);
      
      timerRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);

    } catch (err) {
      console.error("Erro ao acessar microfone:", err);
      alert("Permissão de microfone negada ou não suportada.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // --- ENVIO ---
  const handleSend = async () => {
      if ((!input.trim() && attachments.length === 0) || loading) return;
      
      const userMsg: Message = { 
          id: Date.now().toString(),
          role: 'user', 
          text: input, 
          time: new Date().toLocaleTimeString(),
          attachments: [...attachments]
      };
      
      setMessages(prev => [...prev, userMsg]);
      setInput('');
      setAttachments([]);
      setLoading(true);

      try {
          // Prepara payload multimodal para o serviço
          const response = await aiService.chatWithContext(userMsg.text, dataContext, userMsg.attachments);
          
          setMessages(prev => [...prev, { 
              id: (Date.now() + 1).toString(),
              role: 'ai', 
              text: response, 
              time: new Date().toLocaleTimeString() 
          }]);
      } catch (error) {
          setMessages(prev => [...prev, { 
              id: (Date.now() + 1).toString(),
              role: 'ai', 
              text: "Desculpe, tive um problema ao processar sua solicitação. Verifique sua conexão ou a chave da API.", 
              time: new Date().toLocaleTimeString() 
          }]);
      } finally {
          setLoading(false);
      }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity" onClick={onClose} />
      
      <div className="fixed top-0 right-0 h-full w-full md:w-[500px] bg-white shadow-2xl z-[101] flex flex-col animate-in slide-in-from-right duration-300 border-l border-white/20">
        
        {/* EXECUTIVE HEADER */}
        <div className="relative p-6 bg-[#0F172A] text-white flex justify-between items-center shadow-lg overflow-hidden">
            {/* Background Abstract */}
            <div className="absolute inset-0 bg-gradient-to-r from-blue-900/50 to-indigo-900/50 pointer-events-none"></div>
            <div className="absolute -right-10 -top-10 w-40 h-40 bg-blue-500/20 rounded-full blur-3xl pointer-events-none"></div>

            <div className="relative z-10 flex items-center gap-4">
                <div className="relative">
                    <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-3 rounded-2xl shadow-xl shadow-indigo-500/30 border border-white/10">
                        <Bot size={24} className="text-white" />
                    </div>
                    {loading && (
                        <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-[#0F172A] animate-pulse"></span>
                    )}
                </div>
                <div>
                    <h3 className="font-black text-lg tracking-tight leading-none text-white">EventPro AI</h3>
                    <p className="text-[10px] text-blue-200 font-bold uppercase tracking-widest mt-1 flex items-center gap-1.5">
                        {contextLoading ? <Loader2 size={10} className="animate-spin"/> : <span className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.8)]"></span>}
                        Inteligência de Frotas
                    </p>
                </div>
            </div>
            <button onClick={onClose} className="relative z-10 p-2 text-slate-400 hover:text-white hover:bg-white/10 rounded-xl transition-all"><X size={20}/></button>
        </div>

        {/* MESSAGES AREA */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8 bg-slate-50 scroll-smooth">
            {messages.map((msg, idx) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                    
                    {msg.role === 'ai' && (
                        <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 mt-1 shrink-0 border border-indigo-200">
                            <Sparkles size={14} className="text-indigo-600" />
                        </div>
                    )}

                    <div className={`max-w-[85%] flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* ATTACHMENTS DISPLAY IN CHAT */}
                        {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 mb-1 justify-end">
                                {msg.attachments.map((att, i) => (
                                    <div key={i} className="rounded-xl overflow-hidden border border-slate-200 shadow-sm bg-white">
                                        {att.type === 'image' ? (
                                            <img src={att.url} alt="attachment" className="w-32 h-24 object-cover" />
                                        ) : att.type === 'audio' ? (
                                            <div className="flex items-center gap-2 p-3 w-40 bg-slate-100">
                                                <Mic size={16} className="text-slate-500"/>
                                                <span className="text-[10px] font-bold text-slate-600">Áudio Enviado</span>
                                            </div>
                                        ) : (
                                            <div className="flex items-center gap-2 p-3 w-40 bg-slate-50">
                                                <FileText size={16} className="text-slate-500"/>
                                                <span className="text-[10px] font-bold text-slate-600 truncate">{att.name}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                        <div className={`p-5 shadow-sm relative group pb-7 ${
                            msg.role === 'user' 
                                ? 'bg-white text-slate-800 rounded-[28px] rounded-tr-md rounded-br-[24px] border border-slate-200' 
                                : 'bg-indigo-600 text-white rounded-[28px] rounded-tl-md rounded-bl-[24px] shadow-indigo-200'
                        }`}>
                            <div className={`text-sm leading-relaxed whitespace-pre-wrap font-medium ${msg.role === 'ai' ? 'prose-invert' : ''}`}>
                                {msg.text || (msg.attachments?.length ? <i>(Mídia enviada)</i> : '')}
                            </div>
                            <span className={`text-[9px] font-bold absolute bottom-3 right-5 opacity-60 ${msg.role === 'ai' ? 'text-indigo-200' : 'text-slate-400'}`}>
                                {msg.time}
                            </span>
                        </div>

                        {/* SUGGESTÃO CONTEXTUAL DE MÍDIA */}
                        {msg.role === 'ai' && idx === messages.length - 1 && !loading && (
                            <div className="mt-1 flex gap-2">
                                {(msg.text.toLowerCase().includes('avaria') || msg.text.toLowerCase().includes('foto')) && (
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-indigo-100 transition-colors shadow-sm">
                                        <ImageIcon size={14} /> Enviar Foto da Avaria
                                    </button>
                                )}
                                {(msg.text.toLowerCase().includes('orçament') || msg.text.toLowerCase().includes('documento')) && (
                                    <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-[10px] font-black uppercase tracking-widest px-4 py-2 rounded-full border border-indigo-100 transition-colors shadow-sm">
                                        <FileText size={14} /> Anexar Orçamento/NF
                                    </button>
                                )}
                            </div>
                        )}

                    </div>

                    {msg.role === 'user' && (
                        <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center ml-3 mt-1 shrink-0 border border-slate-300">
                            <User size={14} className="text-slate-600" />
                        </div>
                    )}
                </div>
            ))}
            
            {loading && (
                <div className="flex justify-start animate-in fade-in">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center mr-3 mt-1 border border-indigo-200">
                        <Sparkles size={14} className="text-indigo-600" />
                    </div>
                    <div className="bg-white border border-slate-200 p-4 rounded-2xl rounded-tl-sm shadow-sm flex items-center gap-3">
                        <div className="flex space-x-1">
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                            <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                        </div>
                        <span className="text-xs font-bold text-slate-500">Analisando contexto...</span>
                    </div>
                </div>
            )}
            <div ref={messagesEndRef} />
        </div>

        {/* ATTACHMENT PREVIEW AREA */}
        {attachments.length > 0 && (
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex gap-3 overflow-x-auto">
                {attachments.map((att, idx) => (
                    <div key={idx} className="relative group shrink-0">
                        <div className="w-16 h-16 rounded-xl border border-slate-300 bg-white overflow-hidden flex items-center justify-center">
                            {att.type === 'image' ? (
                                <img src={att.url} className="w-full h-full object-cover" />
                            ) : att.type === 'audio' ? (
                                <Mic className="text-blue-500" />
                            ) : (
                                <FileText className="text-slate-500" />
                            )}
                        </div>
                        <button 
                            onClick={() => removeAttachment(idx)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-md hover:bg-red-600 transition-all opacity-0 group-hover:opacity-100"
                        >
                            <X size={10} strokeWidth={3}/>
                        </button>
                    </div>
                ))}
            </div>
        )}

        {/* MULTIMODAL INPUT AREA */}
        <div className="p-4 bg-white border-t border-slate-100">
            {isRecording ? (
                <div className="flex items-center justify-between p-3 bg-red-50 border border-red-100 rounded-2xl animate-pulse">
                    <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-red-500 rounded-full animate-ping"></div>
                        <span className="text-red-600 font-bold text-sm tracking-widest">{formatTime(recordingTime)}</span>
                    </div>
                    <button onClick={stopRecording} className="flex items-center gap-2 px-4 py-2 bg-white text-red-600 rounded-xl font-black text-xs uppercase shadow-sm hover:bg-red-50 border border-red-200">
                        <StopCircle size={16}/> Parar
                    </button>
                </div>
            ) : (
                <div className="flex items-end gap-2">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-3xl p-2 flex items-end focus-within:ring-2 focus-within:ring-indigo-500/20 focus-within:border-indigo-500 transition-all shadow-inner">
                        {/* Media Buttons */}
                        <div className="flex gap-1 pb-1 pl-1">
                            <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-all" title="Anexar Imagem/Arquivo">
                                <Paperclip size={20} />
                            </button>
                            <button onClick={startRecording} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Gravar Áudio">
                                <Mic size={20} />
                            </button>
                            <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept="image/*,application/pdf"
                                onChange={handleFileSelect}
                            />
                        </div>

                        {/* Text Input */}
                        <textarea 
                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 font-medium max-h-32 min-h-[44px] py-3 px-2 resize-none placeholder:text-slate-400"
                            placeholder="Descreva, envie uma foto ou grave um áudio..."
                            value={input}
                            onChange={e => setInput(e.target.value)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSend();
                                }
                            }}
                            rows={1}
                        />
                    </div>

                    {/* Send Button */}
                    <button 
                        onClick={handleSend}
                        disabled={(!input.trim() && attachments.length === 0) || loading}
                        className="p-4 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 disabled:bg-slate-300 transition-all shadow-xl shadow-indigo-600/20 hover:scale-105 active:scale-95"
                    >
                        <Send size={20} fill="currentColor" className={input.trim() ? "translate-x-0.5" : ""} />
                    </button>
                </div>
            )}
            
            <div className="mt-3 text-center">
                <p className="text-[9px] text-slate-400 font-medium">
                    <span className="font-bold text-indigo-500">Dica:</span> Envie fotos de NFs ou grave vistorias para análise automática.
                </p>
            </div>
        </div>
      </div>
    </>
  );
};

export default AIChatWindow;
