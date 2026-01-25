
import React, { useState, useMemo } from 'react';
import { 
  ShoppingCart, Search, Filter, FileText, 
  CheckCircle2, XCircle, Send, Printer, MoreVertical, 
  Clock, DollarSign, UserCheck, X, ChevronDown, ListFilter,
  Eye, EyeOff, Share2, Download
} from 'lucide-react';
import { PurchaseOrder } from '../types';

const Purchases: React.FC = () => {
  // Simulação de Role (Em um sistema real viria do AuthContext)
  // Altere para 'User' para testar a restrição de valores
  const [currentUserRole] = useState<'Admin' | 'Gerente' | 'User'>('Admin');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  
  const [orders, setOrders] = useState<PurchaseOrder[]>([
    {
      id: '1',
      code: 'OC-2024-001',
      eventId: '1',
      supplierId: 's1',
      total: 1367.13,
      status: 'Aprovada',
      createdAt: '2024-05-12T10:00:00Z',
      items: [
        { catalogId: 'c1', name: 'Parachoque Corolla', quantity: 1, price: 967.13 },
        { catalogId: 'c2', name: 'Mão de Obra', quantity: 1, price: 400.00 }
      ]
    },
    {
      id: '2',
      code: 'OC-2024-002',
      eventId: '1',
      supplierId: 's2',
      total: 6850.00,
      status: 'Gerada',
      createdAt: '2024-05-14T15:30:00Z',
      items: []
    },
    {
      id: '3',
      code: 'OC-2024-003',
      eventId: '2',
      supplierId: 's3',
      total: 12450.50,
      status: 'Enviada',
      createdAt: '2024-05-15T09:00:00Z',
      items: []
    }
  ]);

  const canApprove = currentUserRole === 'Admin' || currentUserRole === 'Gerente';
  const canSeeValues = currentUserRole === 'Admin' || currentUserRole === 'Gerente';

  const handleApprove = (id: string) => {
    if (!canApprove) {
      alert("Apenas administradores ou gestores podem aprovar ordens de compra.");
      return;
    }
    setOrders(prev => prev.map(o => o.id === id ? { ...o, status: 'Aprovada' } : o));
    alert("Ordem de Compra aprovada com sucesso!");
  };

  const handlePrint = (code: string) => {
    alert(`Gerando PDF da Ordem de Compra ${code}...`);
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'Aprovada': return 'bg-green-100 text-green-700 border-green-200';
      case 'Gerada': return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'Enviada': return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'Cancelada': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.code.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  const totalMonth = useMemo(() => {
    return orders.reduce((acc, curr) => acc + curr.total, 0);
  }, [orders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header com Dashboard Financeiro Otimizado */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Ordens de Compra</h2>
          <p className="text-sm text-slate-500 font-medium">Controle e aprovação de pedidos para fornecedores.</p>
        </div>

        {canSeeValues && (
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6 min-w-[280px] animate-in slide-in-from-right-4 duration-500">
            <div className="bg-green-50 p-4 rounded-2xl text-green-600 shadow-inner">
              <DollarSign size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total do Mês</p>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">
                R$ {totalMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Barra de Busca e Filtros Avançados */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 relative">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por OC ou Fornecedor..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2">
          <button 
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${showFilters ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
          >
            <Filter size={18} /> Filtros
          </button>
        </div>

        {/* Dropdown de Filtros */}
        {showFilters && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[32px] shadow-2xl p-6 z-30 animate-in slide-in-from-top-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Filtrar por Status</label>
                <div className="flex flex-wrap gap-2">
                  {['Todos', 'Gerada', 'Aprovada', 'Enviada', 'Cancelada'].map(s => (
                    <button 
                      key={s}
                      onClick={() => setFilterStatus(s)}
                      className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${filterStatus === s ? 'bg-blue-600 text-white border-blue-600 shadow-lg shadow-blue-500/20' : 'bg-slate-50 text-slate-500 border-slate-100 hover:border-slate-300'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className="col-span-2 flex justify-end items-end">
                <button 
                  onClick={() => { setFilterStatus('Todos'); setSearchTerm(''); }}
                  className="text-[10px] font-black uppercase text-red-500 hover:bg-red-50 px-4 py-2 rounded-xl transition-all"
                >
                  Limpar Todos
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Listagem de OCs Estilizada */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? filteredOrders.map(order => (
          <div key={order.id} className="bg-white p-4 md:p-6 rounded-[32px] shadow-sm border border-slate-100 hover:border-blue-200 transition-all flex flex-col md:flex-row items-center gap-6 group">
            
            {/* Ícone e Identificação */}
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-[20px] flex items-center justify-center border border-blue-100 shadow-sm transition-transform group-hover:scale-105">
                <ShoppingCart size={28} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className="font-black text-xl text-slate-800 tracking-tight">{order.code}</h3>
                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase tracking-[0.15em] border ${getStatusStyle(order.status)} shadow-sm`}>
                    {order.status}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase tracking-tight">
                  Evento: <span className="text-blue-600">EVT-2024-001</span> • Criado em {new Date(order.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            {/* Dados Centrais - Grid */}
            <div className="flex flex-1 w-full justify-between items-center md:px-10 gap-4">
              <div className="flex-1 min-w-0">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Fornecedor</p>
                <p className="text-sm font-black text-slate-800 truncate">TAURO Peças</p>
              </div>
              
              <div className="flex-1 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor Total</p>
                <p className={`text-sm font-black ${canSeeValues ? 'text-green-600' : 'text-slate-300'}`}>
                  {canSeeValues ? `R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}
                </p>
              </div>

              <div className="flex-1 text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Itens</p>
                <p className="text-sm font-black text-slate-800">{order.items.length || '-'} un</p>
              </div>
            </div>

            {/* Ações Laterais */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
              {order.status === 'Gerada' && (
                <button 
                  onClick={() => handleApprove(order.id)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${canApprove ? 'bg-green-600 text-white shadow-green-600/20 hover:bg-green-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <UserCheck size={18} /> Aprovar
                </button>
              )}
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePrint(order.code)}
                  className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" 
                  title="Imprimir PDF"
                >
                  <Printer size={20}/>
                </button>
                <button className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Enviar WhatsApp/Email">
                  <Send size={20}/>
                </button>
                <div className="relative group/more">
                  <button className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition-all">
                    <MoreVertical size={20}/>
                  </button>
                  <div className="absolute right-0 bottom-full mb-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-2xl hidden group-hover/more:block z-20 animate-in fade-in slide-in-from-bottom-2">
                    <button className="w-full px-5 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                      <Eye size={16}/> Visualizar Itens
                    </button>
                    <button className="w-full px-5 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50">
                      <Download size={16}/> Baixar XML/NF
                    </button>
                    <button className="w-full px-5 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3">
                      <XCircle size={16}/> Cancelar OC
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="py-24 text-center space-y-4 bg-slate-50 rounded-[48px] border-4 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto text-slate-200 shadow-inner">
                <ShoppingCart size={40} />
             </div>
             <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhuma ordem de compra encontrada</p>
          </div>
        )}
      </div>

      {/* Alerta de Segurança/Permissão */}
      {!canSeeValues && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
           <EyeOff size={18} className="text-amber-400" />
           <p className="text-xs font-black uppercase tracking-widest">Modo Restrito: Valores financeiros ocultos para seu perfil.</p>
        </div>
      )}
    </div>
  );
};

export default Purchases;
