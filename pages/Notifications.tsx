
import React, { useState } from 'react';
import { 
  Bell, CheckCircle2, AlertTriangle, ShoppingBag, Info, 
  CheckCheck, Clock, User, FileText, Search, Trash2
} from 'lucide-react';

const Notifications: React.FC = () => {
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  
  // Mock Data estático para a página de histórico
  const [notifications, setNotifications] = useState([
    { id: 1, title: 'Aprovação Pendente', desc: 'OC-2024-001 aguardando sua assinatura para prosseguir com a compra das peças de funilaria.', time: '10 min atrás', icon: ShoppingBag, color: 'blue', read: false, type: 'action', date: 'Hoje' },
    { id: 2, title: 'SLA Crítico Detectado', desc: 'O evento EVT-2024-022 excedeu 48h sem cotação iniciada. Verifique a fila de prioridades.', time: '2h atrás', icon: AlertTriangle, color: 'red', read: false, type: 'alert', date: 'Hoje' },
    { id: 3, title: 'Entrega Realizada', desc: 'Peças da OC-2024-003 recebidas na oficina "Mecânica do Beto". Conferência pendente.', time: '1d atrás', icon: CheckCircle2, color: 'green', read: true, type: 'info', date: 'Ontem' },
    { id: 4, title: 'Novo Fornecedor Cadastrado', desc: 'Auto Peças Silva completou o cadastro e está disponível para cotações.', time: '2d atrás', icon: User, color: 'indigo', read: true, type: 'info', date: '25/01' },
    { id: 5, title: 'Cotação Finalizada', desc: '3 fornecedores responderam à cotação #442. Matriz comparativa pronta para análise.', time: '3d atrás', icon: FileText, color: 'blue', read: true, type: 'info', date: '24/01' },
    { id: 6, title: 'Alteração de Senha', desc: 'Sua senha foi alterada com sucesso via painel de configurações.', time: '5d atrás', icon: Info, color: 'slate', read: true, type: 'security', date: '22/01' },
  ]);

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.read;
    return true;
  });

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, read: true })));
  };

  const deleteNotification = (id: number) => {
    setNotifications(notifications.filter(n => n.id !== id));
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Bell className="text-blue-600" size={24} /> Central de Notificações
          </h2>
          <p className="text-sm text-slate-500 font-medium">Acompanhe alertas, pendências e atualizações do sistema.</p>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={markAllAsRead} 
             className="text-xs font-black uppercase tracking-widest text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-xl transition-all flex items-center gap-2"
           >
             <CheckCheck size={16} /> Marcar todas como lidas
           </button>
        </div>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm overflow-hidden">
         {/* Toolbar */}
         <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex bg-white p-1 rounded-xl border border-slate-200 shadow-sm">
               <button 
                 onClick={() => setFilter('all')} 
                 className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${filter === 'all' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                 Todas
               </button>
               <button 
                 onClick={() => setFilter('unread')} 
                 className={`px-6 py-2 rounded-lg text-xs font-black uppercase tracking-wide transition-all ${filter === 'unread' ? 'bg-slate-800 text-white shadow' : 'text-slate-500 hover:bg-slate-50'}`}
               >
                 Não Lidas
               </button>
            </div>
            
            <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16}/>
               <input type="text" placeholder="Filtrar avisos..." className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20 w-64"/>
            </div>
         </div>

         {/* List */}
         <div className="divide-y divide-slate-50">
            {filteredNotifications.length === 0 ? (
                <div className="p-20 text-center text-slate-400">
                   <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Bell size={32} className="text-slate-300"/>
                   </div>
                   <p className="text-sm font-bold uppercase tracking-widest">Nenhuma notificação encontrada</p>
                </div>
            ) : (
                filteredNotifications.map(notification => (
                   <div key={notification.id} className={`p-6 flex items-start gap-5 hover:bg-slate-50 transition-colors group ${!notification.read ? 'bg-blue-50/30' : ''}`}>
                      <div className={`shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm bg-${notification.color}-50 text-${notification.color}-600`}>
                         <notification.icon size={24}/>
                      </div>
                      <div className="flex-1 min-w-0">
                         <div className="flex justify-between items-start mb-1">
                            <h4 className={`text-sm font-bold ${!notification.read ? 'text-slate-900' : 'text-slate-600'}`}>
                               {notification.title}
                               {!notification.read && <span className="ml-2 w-2 h-2 bg-red-500 rounded-full inline-block mb-0.5"></span>}
                            </h4>
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                               <Clock size={12}/> {notification.date} • {notification.time}
                            </span>
                         </div>
                         <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">{notification.desc}</p>
                      </div>
                      <button 
                        onClick={() => deleteNotification(notification.id)}
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                        title="Excluir notificação"
                      >
                         <Trash2 size={18}/>
                      </button>
                   </div>
                ))
            )}
         </div>
      </div>
    </div>
  );
};

export default Notifications;
