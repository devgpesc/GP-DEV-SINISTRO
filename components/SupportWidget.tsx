import React, { useState, useRef, useEffect } from 'react';
import { 
  MessageCircle, X, Send, LifeBuoy, Loader2, 
  ChevronDown, Mic, Paperclip, Video, StopCircle, 
  Trash2, FileText, Image as ImageIcon, Film, UploadCloud,
  BrainCircuit, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { aiService } from '../services/aiService';
import * as ReactRouterDOM from 'react-router-dom';
const { useLocation } = ReactRouterDOM as any;

interface Attachment {
  id: string;
  file: File;
  type: 'image' | 'video' | 'audio' | 'document';
  previewUrl: string;
  base64?: string;
}

const MEMORY_KEY = 'esc_support_memory_v2'; // Alterada versão para forçar reset limpo

const SupportWidget: React.FC = () => {
  const { user, currentTenant, profile } = useAuth();
  const location = useLocation();
  
  // Estados de Interface
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  
  // Estados de Mídia
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  
  // Estados de Vídeo
  const [showVideoModal, setShowVideoModal] = useState(false);
  const [isRecordingVideo, setIsRecordingVideo] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const initialMessage = { 
    id: 'welcome', 
    role: 'agent', 
    text: 'Olá! Sou seu Gerente de Suporte Virtual. Estou analisando seu contexto atual. Como posso destravar seu trabalho agora?' 
  };

  const [messages, setMessages] = useState<any[]>([initialMessage]);

  // Refs
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const videoChunksRef = useRef<Blob[]>([]);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  // --- GERENCIAMENTO DE SESSÃO DO CHAT ---
  useEffect(() => {
    if (user?.id) {
        // Tenta carregar histórico salvo
        const savedData = localStorage.getItem(MEMORY_KEY);
        if (savedData) {
            try {
                const parsed = JSON.parse(savedData);
                // VERIFICAÇÃO CRÍTICA: O histórico pertence a este usuário?
                if (parsed.userId === user.id && Array.isArray(parsed.history)) {
                    setMessages([...parsed.history, { 
                        id: 'divider-' + Date.now(), 
                        role: 'system', 
                        text: '--- Sessão Restaurada ---' 
                    }]);
                } else {
                    // Se for outro usuário ou dados inválidos, limpa tudo
                    console.log('Resetting chat: Different user or invalid data');
                    localStorage.removeItem(MEMORY_KEY);
                    setMessages([initialMessage]);
                }
            } catch (e) {
                localStorage.removeItem(MEMORY_KEY);
                setMessages([initialMessage]);
            }
        }
    } else {
        // Se não tem usuário (logout), limpa o estado visual
        setMessages([initialMessage]);
        setIsOpen(false);
    }
  }, [user?.id]); // Depende explicitamente do ID do usuário

  // Salvar histórico a cada nova mensagem
  useEffect(() => {
    if (user?.id && messages.length > 1) {
        const payload = {
            userId: user.id,
            history: messages.filter(m => m.role !== 'system')
        };
        localStorage.setItem(MEMORY_KEY, JSON.stringify(payload));
    }
  }, [messages, user]);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen, attachments, loading, isClassifying]);

  // --- HELPERS DE ARQUIVO ---
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(',')[1]);
      reader.onerror = error => reject(error);
    });
  };

  const addFiles = async (files: FileList | File[]) => {
    const newAttachments: Attachment[] = [];
    
    for (const file of Array.from(files)) {
      let type: Attachment['type'] = 'document';
      if (file.type.startsWith('image/')) type = 'image';
      else if (file.type.startsWith('video/')) type = 'video';
      else if (file.type.startsWith('audio/')) type = 'audio';

      const base64 = await fileToBase64(file);

      newAttachments.push({
        id: Math.random().toString(36).substr(2, 9),
        file,
        type,
        previewUrl: URL.createObjectURL(file),
        base64
      });
    }
    setAttachments(prev => [...prev, ...newAttachments]);
  };

  // --- DRAG & DROP ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  // --- ÁUDIO ---
  const startAudioRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], "audio-message.webm", { type: 'audio/webm' });
        await addFiles([file]);
        setIsRecordingAudio(false);
        setRecordingTime(0);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      setIsRecordingAudio(true);
      timerRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (e) {
      alert("Permissão de microfone negada.");
    }
  };

  const stopAudioRecording = () => {
    if (mediaRecorderRef.current && isRecordingAudio) {
      mediaRecorderRef.current.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  // --- VÍDEO (MODAL) ---
  const openVideoModal = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setVideoStream(stream);
      setShowVideoModal(true);
    } catch (e) {
      alert("Permissão de câmera negada.");
    }
  };

  const closeVideoModal = () => {
    if (videoStream) videoStream.getTracks().forEach(track => track.stop());
    setVideoStream(null);
    setShowVideoModal(false);
    setIsRecordingVideo(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setRecordingTime(0);
  };

  useEffect(() => {
    if (showVideoModal && videoPreviewRef.current && videoStream) {
      videoPreviewRef.current.srcObject = videoStream;
    }
  }, [showVideoModal, videoStream]);

  const toggleVideoRecording = () => {
    if (isRecordingVideo) {
      // Stop
      if (mediaRecorderRef.current) mediaRecorderRef.current.stop();
      setIsRecordingVideo(false);
      if (timerRef.current) clearInterval(timerRef.current);
      setRecordingTime(0);
    } else {
      // Start
      if (!videoStream) return;
      mediaRecorderRef.current = new MediaRecorder(videoStream);
      videoChunksRef.current = [];
      
      mediaRecorderRef.current.ondataavailable = (e) => videoChunksRef.current.push(e.data);
      mediaRecorderRef.current.onstop = async () => {
        const blob = new Blob(videoChunksRef.current, { type: 'video/webm' });
        const file = new File([blob], "video-message.webm", { type: 'video/webm' });
        await addFiles([file]);
        closeVideoModal();
      };

      mediaRecorderRef.current.start();
      setIsRecordingVideo(true);
      timerRef.current = window.setInterval(() => setRecordingTime(p => p + 1), 1000);
    }
  };

  // --- ENVIO ---
  const handleSend = async () => {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    // Se estiver gravando áudio, para antes de enviar
    if (isRecordingAudio) stopAudioRecording();

    // Pequeno delay para garantir que o áudio foi processado se parou agora
    if (isRecordingAudio) await new Promise(r => setTimeout(r, 500));

    const currentAttachments = [...attachments];
    const userMsg = { 
      id: Date.now().toString(), 
      role: 'user', 
      text: input, 
      attachments: currentAttachments 
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setAttachments([]);
    setLoading(true);

    try {
      const context = {
        tenant: currentTenant?.name || 'Não identificado',
        plan: currentTenant?.saas_plans?.name || 'Free',
        user: profile?.full_name || user?.email,
        screen: location.pathname,
        timestamp: new Date().toLocaleString()
      };

      // Recupera resumo da memória (últimos 3 tópicos)
      const memorySummary = messages
        .filter(m => m.role === 'user')
        .slice(-3)
        .map(m => m.text)
        .join('; ');

      const responseText = await aiService.chatSupport(userMsg.text, context, currentAttachments, memorySummary);
      
      setMessages(prev => [...prev, { 
        id: (Date.now() + 1).toString(), 
        role: 'agent', 
        text: responseText 
      }]);

    } catch (error: any) {
      setMessages(prev => [...prev, { 
        id: Date.now().toString(), 
        role: 'agent', 
        text: `Erro de conexão: ${error.message || 'Tente novamente.'}`
      }]);
    } finally {
      setLoading(false);
    }
  };

  // --- ESCALONAMENTO INTELIGENTE (Advanced) ---
  const handleEscalateToWhatsApp = async () => {
    setIsClassifying(true);
    
    // 1. Coleta Contexto
    const context = {
        tenant: currentTenant?.name || 'Não identificado',
        plan: currentTenant?.saas_plans?.name || 'Free',
        user: profile?.full_name || user?.email,
        screen: location.pathname,
    };

    // 2. Chama AI Flash para classificar
    const dossier = await aiService.classifySupportTicket(messages, context);
    
    setIsClassifying(false);

    // 3. Formata Mensagem Rica para WhatsApp
    const priorityIcon = dossier.priority === 'Crítica' || dossier.priority === 'Alta' ? '🔴' : '🟢';
    
    const text = `
${priorityIcon} *CHAMADO ESC SOLUTIONS*

👤 *Cliente:* ${currentTenant?.name}
📍 *Tela:* ${location.pathname}
🔧 *Categoria:* ${dossier.technical_category}
📊 *Prioridade:* ${dossier.priority.toUpperCase()}

📝 *Resumo do Problema:*
${dossier.summary}

🤖 *Diagnóstico Preliminar:*
${dossier.suggested_fix}

_Ticket gerado via EventPro AI_
    `.trim();

    window.open(`https://wa.me/5562998464374?text=${encodeURIComponent(text)}`, '_blank');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 w-14 h-14 bg-[#075E54] hover:bg-[#128C7E] text-white rounded-full shadow-2xl flex items-center justify-center transition-all hover:scale-110 z-[90] animate-in zoom-in"
      >
        <LifeBuoy size={28} />
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white"></span>
      </button>
    );
  }

  return (
    <>
      <div 
        className={`fixed bottom-6 right-6 w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-[90] overflow-hidden flex flex-col transition-all duration-300 ${isMinimized ? 'h-16' : 'h-[650px] max-h-[85vh]'}`}
      >
        {/* Header */}
        <div className="bg-[#075E54] p-4 flex justify-between items-center text-white shrink-0">
          <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md relative">
              <LifeBuoy size={20} />
              <div className="absolute -bottom-1 -right-1 bg-green-400 w-3 h-3 rounded-full border-2 border-[#075E54]"></div>
            </div>
            <div>
              <h3 className="font-bold text-sm leading-tight">Suporte ESC Solutions</h3>
              <p className="text-[10px] text-green-100 flex items-center gap-1">
                Gerente Virtual Online
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIsMinimized(!isMinimized)}><ChevronDown size={18}/></button>
            <button onClick={() => setIsOpen(false)}><X size={18}/></button>
          </div>
        </div>

        {!isMinimized && (
          <>
            {/* Top Bar - Intelligent Escalation */}
            <div className="bg-green-50 p-3 border-b border-green-100 flex justify-between items-center px-4 shrink-0">
               <span className="text-[10px] font-bold text-green-800 uppercase flex items-center gap-1">
                   {isClassifying ? <Loader2 className="animate-spin" size={10}/> : <BrainCircuit size={12}/>}
                   {isClassifying ? 'Gerando Dossiê...' : 'Análise Avançada'}
               </span>
               <button 
                 onClick={handleEscalateToWhatsApp} 
                 disabled={isClassifying}
                 className="flex items-center gap-1.5 bg-[#25D366] text-white px-3 py-1.5 rounded-full text-[10px] font-bold uppercase hover:bg-[#128C7E] shadow-sm disabled:opacity-70 transition-all"
               >
                  <MessageCircle size={12} fill="white" /> Falar com Humano
               </button>
            </div>

            {/* Chat Area (Droppable) */}
            <div 
              className="flex-1 overflow-y-auto p-4 bg-[#E5DDD5] space-y-4 relative"
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="absolute inset-0 opacity-[0.06] pointer-events-none" style={{backgroundImage: 'url("https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png")'}}></div>
              
              {/* Drag Overlay */}
              {isDragging && (
                <div className="absolute inset-0 z-50 bg-green-900/80 backdrop-blur-sm flex flex-col items-center justify-center text-white border-4 border-dashed border-white m-2 rounded-xl animate-in fade-in">
                   <UploadCloud size={48} className="mb-2"/>
                   <p className="font-bold text-lg">Solte os arquivos aqui</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <React.Fragment key={i}>
                    {msg.role === 'system' ? (
                        <div className="flex justify-center my-4">
                            <span className="text-[10px] font-bold text-slate-400 bg-slate-200/50 px-3 py-1 rounded-full uppercase tracking-widest">{msg.text}</span>
                        </div>
                    ) : (
                        <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} relative z-10 group`}>
                        {msg.role === 'agent' && (
                            <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 shrink-0 text-[#075E54]">
                                <LifeBuoy size={14}/>
                            </div>
                        )}
                        <div className="flex flex-col gap-1 max-w-[85%]">
                            {/* Render Attachments in Chat History */}
                            {msg.attachments && msg.attachments.length > 0 && (
                                <div className={`flex flex-wrap gap-1 mb-1 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                    {msg.attachments.map((att: Attachment, idx: number) => (
                                        <div key={idx} className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm">
                                            {att.type === 'image' ? (
                                                <img src={att.previewUrl} className="w-24 h-24 object-cover rounded-md"/>
                                            ) : att.type === 'video' ? (
                                                <video src={att.previewUrl} className="w-32 h-24 object-cover rounded-md" controls/>
                                            ) : (
                                                <div className="w-24 h-24 flex flex-col items-center justify-center bg-slate-50 rounded-md text-slate-500">
                                                    {att.type === 'audio' ? <Mic size={24}/> : <FileText size={24}/>}
                                                    <span className="text-[9px] mt-1 font-bold uppercase">{att.type}</span>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            {msg.text && (
                                <div className={`p-3 rounded-xl text-sm shadow-sm leading-relaxed whitespace-pre-wrap ${
                                msg.role === 'user' 
                                    ? 'bg-[#DCF8C6] text-slate-800 rounded-tr-none' 
                                    : 'bg-white text-slate-800 rounded-tl-none'
                                }`}>
                                {msg.text}
                                <div className={`text-[9px] text-right mt-1 opacity-50 font-bold ${msg.role === 'user' ? 'text-green-900' : 'text-slate-500'}`}>
                                    {new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                </div>
                                </div>
                            )}
                            
                            {/* Feedback Actions (Only Agent) */}
                            {msg.role === 'agent' && i === messages.length - 1 && !loading && (
                                <div className="flex gap-2 mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button className="text-slate-400 hover:text-green-600" title="Útil"><ThumbsUp size={12}/></button>
                                    <button className="text-slate-400 hover:text-red-600" title="Não resolveu"><ThumbsDown size={12}/></button>
                                </div>
                            )}
                        </div>
                        </div>
                    )}
                </React.Fragment>
              ))}
              
              {loading && (
                 <div className="flex justify-start relative z-10 animate-in fade-in duration-300">
                    <div className="w-6 h-6 rounded-full bg-white border border-slate-200 flex items-center justify-center mr-2 mt-1 shrink-0 text-[#075E54]">
                       <LifeBuoy size={14}/>
                    </div>
                    <div className="bg-white p-3.5 rounded-xl rounded-tl-none shadow-sm flex items-center gap-1.5 min-w-[60px]">
                       <div className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                       <div className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                       <div className="w-1.5 h-1.5 bg-[#075E54] rounded-full animate-bounce"></div>
                    </div>
                 </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Attachment Preview Area (Bottom) */}
            {attachments.length > 0 && (
                <div className="px-3 py-2 bg-slate-100 border-t border-slate-200 flex gap-2 overflow-x-auto">
                    {attachments.map((att) => (
                        <div key={att.id} className="relative group shrink-0 w-16 h-16 bg-white rounded-lg border border-slate-300 flex items-center justify-center overflow-hidden">
                            {att.type === 'image' ? (
                                <img src={att.previewUrl} className="w-full h-full object-cover"/>
                            ) : att.type === 'video' ? (
                                <Film size={24} className="text-slate-400"/>
                            ) : att.type === 'audio' ? (
                                <Mic size={24} className="text-slate-400"/>
                            ) : (
                                <FileText size={24} className="text-slate-400"/>
                            )}
                            <button onClick={() => setAttachments(prev => prev.filter(p => p.id !== att.id))} className="absolute top-0 right-0 bg-red-500 text-white p-0.5 rounded-bl-lg opacity-0 group-hover:opacity-100 transition-opacity">
                                <X size={12}/>
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Input Toolbar */}
            <div className="p-2 bg-[#F0F0F0] border-t border-slate-200">
              {isRecordingAudio ? (
                  <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-red-200 animate-pulse">
                      <div className="flex items-center gap-2 text-red-600 font-bold text-xs">
                          <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                          Gravando áudio... {formatTime(recordingTime)}
                      </div>
                      <button onClick={stopAudioRecording} className="text-red-500 hover:text-red-700 p-1"><StopCircle size={20}/></button>
                  </div>
              ) : (
                  <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-1 px-1">
                          <button onClick={() => fileInputRef.current?.click()} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title="Anexar Arquivo">
                              <Paperclip size={18}/>
                          </button>
                          <button onClick={openVideoModal} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title="Gravar Vídeo">
                              <Video size={18}/>
                          </button>
                          <button onClick={startAudioRecording} className="p-2 text-slate-500 hover:bg-slate-200 rounded-full transition-colors" title="Gravar Áudio">
                              <Mic size={18}/>
                          </button>
                          <input type="file" ref={fileInputRef} className="hidden" multiple onChange={e => e.target.files && addFiles(e.target.files)}/>
                      </div>
                      
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
                          disabled={loading || (!input.trim() && attachments.length === 0)}
                          className="w-9 h-9 bg-[#075E54] text-white rounded-full flex items-center justify-center hover:bg-[#128C7E] disabled:opacity-50 disabled:bg-slate-400 transition-all"
                        >
                          {loading ? <Loader2 size={16} className="animate-spin"/> : <Send size={16} className="ml-0.5"/>}
                        </button>
                      </div>
                  </div>
              )}
              <div className="text-center mt-1">
                 <p className="text-[8px] text-slate-400">Ambiente monitorado • IA ativa</p>
              </div>
            </div>
          </>
        )}
      </div>

      {/* MODAL DE GRAVAÇÃO DE VÍDEO */}
      {showVideoModal && (
          <div className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 animate-in fade-in">
              <div className="relative w-full max-w-lg bg-black rounded-2xl overflow-hidden border border-slate-700 shadow-2xl">
                  <div className="absolute top-4 right-4 z-10">
                      <button onClick={closeVideoModal} className="bg-black/50 text-white p-2 rounded-full hover:bg-red-600 transition-colors"><X size={20}/></button>
                  </div>
                  <video ref={videoPreviewRef} autoPlay muted className="w-full aspect-video object-cover bg-slate-900"></video>
                  <div className="absolute bottom-6 left-0 right-0 flex justify-center items-center gap-4">
                      {isRecordingVideo ? (
                          <div className="flex flex-col items-center gap-2">
                              <span className="text-red-500 font-black font-mono text-xl animate-pulse">{formatTime(recordingTime)}</span>
                              <button onClick={toggleVideoRecording} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center bg-red-600 hover:scale-105 transition-transform">
                                  <div className="w-6 h-6 bg-white rounded-sm"></div>
                              </button>
                          </div>
                      ) : (
                          <button onClick={toggleVideoRecording} className="w-16 h-16 rounded-full border-4 border-white flex items-center justify-center hover:scale-105 transition-transform">
                              <div className="w-12 h-12 bg-red-600 rounded-full"></div>
                          </button>
                      )}
                  </div>
                  <div className="absolute top-4 left-4 text-white text-xs font-bold bg-black/50 px-2 py-1 rounded">
                      Gravação de Vídeo
                  </div>
              </div>
          </div>
      )}
    </>
  );
};

export default SupportWidget;