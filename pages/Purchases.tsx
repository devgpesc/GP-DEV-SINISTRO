
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Search, Filter, FileText, 
  CheckCircle2, XCircle, Send, Printer, MoreVertical, 
  Clock, DollarSign, UserCheck, X, ChevronDown, ListFilter,
  Eye, EyeOff, Share2, Download, ShieldCheck, AlertTriangle,
  Loader2, Info, Trash2, Package
} from 'lucide-react';
import { PurchaseOrder } from '../types';
import { mockStorage } from '../services/supabaseClient';

const Purchases: React.FC = () => {
  const [currentUserRole] = useState<'Admin' | 'Gerente' | 'User'>('Admin');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  
  // Estado para controlar qual menu está aberto (pelo ID da OC)
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Estado para Visualizar Itens
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);

  // Estado para Notificações (Toast)
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'info' | 'loading' } | null>(null);

  // Estado para o Modal de Confirmação Moderno
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'cancel' | 'delete' | null;
    orderId: string | null;
    orderCode: string | null;
    amount?: number;
  }>({ isOpen: false, type: null, orderId: null, orderCode: null });

  useEffect(() => {
    // Carregar dados do storage (sem mocks hardcoded)
    const savedOrders = mockStorage.get('purchase_orders') || [];
    setOrders(savedOrders);
  }, []);

  // Fechar menu ao clicar fora
  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (toast?.show && toast.type !== 'loading') {
      const timer = setTimeout(() => {
        setToast(null);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const canApprove = currentUserRole === 'Admin' || currentUserRole === 'Gerente';
  const canSeeValues = currentUserRole === 'Admin' || currentUserRole === 'Gerente';

  const updateOrderStatus = (id: string, newStatus: PurchaseOrder['status']) => {
    const updated = orders.map(o => o.id === id ? { ...o, status: newStatus } : o);
    setOrders(updated);
    mockStorage.set('purchase_orders', updated);
  };

  // Abre o modal de aprovação
  const handleRequestApprove = (order: PurchaseOrder) => {
    if (!canApprove) {
      setToast({ show: true, title: 'Acesso Negado', message: 'Apenas gestores podem aprovar OCs.', type: 'info' });
      return;
    }
    setConfirmModal({
      isOpen: true,
      type: 'approve',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  // Abre o modal de cancelamento
  const handleRequestCancel = (order: PurchaseOrder) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  // Abre o modal de exclusão
  const handleRequestDelete = (order: PurchaseOrder) => {
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  // Executa a ação após confirmação no modal
  const executeAction = () => {
    if (confirmModal.orderId && confirmModal.type) {
      if (confirmModal.type === 'approve') {
        updateOrderStatus(confirmModal.orderId, 'Aprovada');
        setToast({ show: true, title: 'Sucesso', message: `Ordem ${confirmModal.orderCode} aprovada.`, type: 'success' });
      } else if (confirmModal.type === 'cancel') {
        updateOrderStatus(confirmModal.orderId, 'Cancelada');
        setToast({ show: true, title: 'Cancelado', message: `Ordem ${confirmModal.orderCode} foi cancelada.`, type: 'info' });
      } else if (confirmModal.type === 'delete') {
        const updated = orders.filter(o => o.id !== confirmModal.orderId);
        setOrders(updated);
        mockStorage.set('purchase_orders', updated);
        setToast({ show: true, title: 'Excluído', message: `Ordem ${confirmModal.orderCode} removida permanentemente.`, type: 'success' });
      }
      setConfirmModal({ isOpen: false, type: null, orderId: null, orderCode: null });
    }
  };

  const handlePrint = (order: PurchaseOrder) => {
    // 1. Mostra notificação de "Gerando..."
    setToast({ 
        show: true, 
        title: 'Gerando PDF', 
        message: `Preparando documento ${order.code} para impressão...`, 
        type: 'loading' 
    });

    // 2. Gera o HTML da fatura
    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.name || 'Item Diverso'}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity || 1}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">R$ ${(item.price || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">R$ ${((item.price || 0) * (item.quantity || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
      </tr>
    `).join('') || '<tr><td colspan="4" style="padding: 20px; text-align: center; color: #999;">Sem itens registrados</td></tr>';

    const printContent = `
      <html>
        <head>
          <title>Ordem de Compra - ${order.code}</title>
          <style>
            body { font-family: 'Helvetica', 'Arial', sans-serif; color: #333; line-height: 1.6; padding: 40px; max-width: 900px; margin: 0 auto; }
            .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 40px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
            .logo h1 { color: #2563eb; margin: 0; font-size: 24px; text-transform: uppercase; letter-spacing: 2px; }
            .logo p { margin: 5px 0 0; font-size: 12px; color: #666; }
            .meta { text-align: right; }
            .meta h2 { margin: 0; font-size: 32px; color: #1e293b; }
            .meta p { margin: 5px 0 0; font-weight: bold; color: #64748b; font-size: 14px; }
            .status-badge { display: inline-block; background: #eee; padding: 4px 12px; border-radius: 4px; font-size: 10px; font-weight: bold; text-transform: uppercase; margin-top: 10px; }
            
            .grid { display: flex; gap: 40px; margin-bottom: 40px; }
            .box { flex: 1; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .box h3 { margin: 0 0 15px; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; }
            .box p { margin: 0; font-size: 14px; font-weight: 600; color: #1e293b; }
            .box span { display: block; font-size: 13px; color: #64748b; font-weight: 400; margin-top: 4px; }

            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th { background: #1e293b; color: white; text-align: left; padding: 12px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
            
            .totals { display: flex; justify-content: flex-end; }
            .totals-box { width: 250px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .row.final { border-top: 2px solid #333; border-bottom: none; margin-top: 10px; padding-top: 15px; font-size: 18px; font-weight: bold; color: #2563eb; }
            
            .footer { margin-top: 60px; padding-top: 30px; border-top: 1px solid #eee; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; color: #94a3b8; }
            .signature { border-top: 1px solid #ccc; width: 200px; padding-top: 10px; text-align: center; color: #333; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo">
              <h1>AutoClaims Pro</h1>
              <p>Sistema de Gestão de Sinistros</p>
            </div>
            <div class="meta">
              <h2>${order.code}</h2>
              <p>EMISSÃO: ${new Date(order.createdAt).toLocaleDateString()}</p>
              <span class="status-badge">${order.status}</span>
            </div>
          </div>

          <div class="grid">
            <div class="box">
              <h3>Fornecedor</h3>
              <p>TAURO Peças LTDA</p>
              <span>CNPJ: 12.345.678/0001-90</span>
              <span>São Paulo - SP</span>
            </div>
            <div class="box">
              <h3>Referência / Evento</h3>
              <p>EVT-2024-001</p>
              <span>Tipo: Colisão</span>
              <span>Associado Ref: A1-99</span>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th width="50%">Descrição do Item</th>
                <th width="10%" style="text-align: center;">Qtd</th>
                <th width="20%" style="text-align: right;">Valor Unit.</th>
                <th width="20%" style="text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
          </table>

          <div class="totals">
            <div class="totals-box">
              <div class="row">
                <span>Subtotal</span>
                <span>R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
              <div class="row">
                <span>Frete</span>
                <span>R$ 0,00</span>
              </div>
              <div class="row final">
                <span>TOTAL</span>
                <span>R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>
          </div>

          <div class="footer">
            <div>
              <p>Documento gerado eletronicamente em ${new Date().toLocaleString()}.</p>
              <p>Aprovação sistêmica válida.</p>
            </div>
            <div class="signature">
              Assinatura Autorizada
            </div>
          </div>
        </body>
      </html>
    `;

    setTimeout(() => {
        setToast({ 
            show: true, 
            title: 'Pronto', 
            message: 'Janela de impressão aberta.', 
            type: 'success' 
        });
        
        // Abre uma nova janela para impressão
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            // Pequeno delay para garantir que estilos carregaram
            setTimeout(() => {
                printWindow.print();
                printWindow.close();
            }, 500);
        } else {
            alert('Permita pop-ups para imprimir.');
        }
    }, 1500);
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
    return orders.filter(o => o.status !== 'Cancelada').reduce((acc, curr) => acc + curr.total, 0);
  }, [orders]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Toast Notification Customizado */}
      {toast && toast.show && (
        <div className="fixed top-6 right-6 z-[110] animate-in slide-in-from-right-10 duration-300">
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 min-w-[320px] border border-slate-700/50">
                <div className="p-2 bg-white/10 rounded-xl">
                    {toast.type === 'loading' ? <Loader2 className="animate-spin" size={20}/> : 
                     toast.type === 'success' ? <CheckCircle2 size={20} className="text-green-400"/> : 
                     <Info size={20} className="text-blue-400"/>}
                </div>
                <div className="flex-1">
                    <p className="font-bold text-sm">{toast.title}</p>
                    <p className="text-xs text-slate-300 mt-0.5">{toast.message}</p>
                </div>
                {toast.type !== 'loading' && (
                    <button onClick={() => setToast(null)} className="text-slate-400 hover:text-white transition-colors">
                        <X size={18}/>
                    </button>
                )}
            </div>
        </div>
      )}

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
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Comprometido</p>
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
              <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center border shadow-sm transition-transform group-hover:scale-105 ${order.status === 'Cancelada' ? 'bg-red-50 text-red-400 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                {order.status === 'Cancelada' ? <XCircle size={28}/> : <ShoppingCart size={28} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className={`font-black text-xl tracking-tight ${order.status === 'Cancelada' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{order.code}</h3>
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
                <p className="text-sm font-black text-slate-800">{order.items?.length || '-'} un</p>
              </div>
            </div>

            {/* Ações Laterais */}
            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
              {order.status === 'Gerada' && (
                <button 
                  onClick={() => handleRequestApprove(order)}
                  className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${canApprove ? 'bg-green-600 text-white shadow-green-600/20 hover:bg-green-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  <UserCheck size={18} /> Aprovar
                </button>
              )}
              
              <div className="flex items-center gap-1">
                <button 
                  onClick={() => handlePrint(order)}
                  className="p-3 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" 
                  title="Imprimir PDF"
                >
                  <Printer size={20}/>
                </button>
                <div className="relative">
                  <button 
                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }}
                    className={`p-3 rounded-xl transition-all ${openMenuId === order.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
                  >
                    <MoreVertical size={20}/>
                  </button>
                  
                  {/* Dropdown Menu - Click Activated */}
                  {openMenuId === order.id && (
                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 animate-in fade-in slide-in-from-bottom-2 overflow-hidden">
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                            <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Opções da OC</p>
                        </div>
                        <button 
                            onClick={() => { setViewOrder(order); setOpenMenuId(null); }}
                            className="w-full px-5 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50"
                        >
                            <Eye size={16}/> Visualizar Itens
                        </button>
                        {order.status !== 'Cancelada' && (
                            <button onClick={() => handleRequestCancel(order)} className="w-full px-5 py-3 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50">
                                <XCircle size={16}/> Cancelar OC
                            </button>
                        )}
                        <button onClick={() => handleRequestDelete(order)} className="w-full px-5 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3">
                            <Trash2 size={16}/> Excluir Registro
                        </button>
                    </div>
                  )}
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

      {/* --- MODAL DE VISUALIZAR ITENS --- */}
      {viewOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewOrder(null)}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><Package size={24}/></div>
                        <div>
                            <h3 className="text-xl font-black text-slate-800">Itens da Compra</h3>
                            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">{viewOrder.code}</p>
                        </div>
                    </div>
                    <button onClick={() => setViewOrder(null)} className="p-2 text-slate-400 hover:text-slate-600 bg-white rounded-full shadow-sm hover:shadow-md transition-all"><X size={20}/></button>
                </div>
                
                {/* List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {viewOrder.items && viewOrder.items.length > 0 ? (
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr>
                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-slate-100">Item / Descrição</th>
                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-slate-100 text-center">Qtd</th>
                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-slate-100 text-right">Unitário</th>
                                    <th className="text-[10px] font-black text-slate-400 uppercase tracking-widest pb-4 border-b border-slate-100 text-right">Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {viewOrder.items.map((item, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                        <td className="py-4 text-sm font-bold text-slate-700">{item.name}</td>
                                        <td className="py-4 text-sm font-bold text-slate-600 text-center">{item.quantity}</td>
                                        <td className="py-4 text-sm font-bold text-slate-600 text-right">R$ {item.price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                        <td className="py-4 text-sm font-black text-slate-800 text-right">R$ {(item.price * item.quantity).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="text-center py-10 text-slate-400">
                            <p className="text-sm font-bold">Nenhum item encontrado.</p>
                        </div>
                    )}
                    
                    {canSeeValues && (
                        <div className="mt-6 flex justify-end border-t border-slate-100 pt-6">
                            <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Valor Total</p>
                                <p className="text-3xl font-black text-blue-600">R$ {viewOrder.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
      )}

      {/* --- MODAL DE CONFIRMAÇÃO MODERNO --- */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 transition-colors ${
              confirmModal.type === 'approve' 
                ? 'bg-green-50 text-green-500 shadow-xl shadow-green-500/10' 
                : confirmModal.type === 'delete'
                    ? 'bg-red-50 text-red-500 shadow-xl shadow-red-500/10'
                    : 'bg-amber-50 text-amber-500 shadow-xl shadow-amber-500/10'
            }`}>
              {confirmModal.type === 'approve' ? <ShieldCheck size={40} /> : confirmModal.type === 'delete' ? <Trash2 size={40} /> : <AlertTriangle size={40} />}
            </div>

            <h3 className="text-xl font-black text-slate-800 mb-2">
              {confirmModal.type === 'approve' ? 'Aprovar Compra?' : confirmModal.type === 'delete' ? 'Excluir Definitivamente?' : 'Cancelar Ordem?'}
            </h3>
            
            <p className="text-sm text-slate-500 font-medium mb-4 leading-relaxed">
              {confirmModal.type === 'approve' 
                ? `Você está prestes a aprovar financeiramente a OC ${confirmModal.orderCode}.`
                : confirmModal.type === 'delete'
                    ? `Atenção: A OC ${confirmModal.orderCode} será removida do sistema e não poderá ser recuperada.`
                    : `Você tem certeza que deseja cancelar a OC ${confirmModal.orderCode}?`
              }
            </p>

            {confirmModal.type === 'approve' && canSeeValues && (
              <div className="mb-8 bg-slate-50 py-3 px-4 rounded-2xl border border-slate-100 inline-block">
                <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">Valor Total</p>
                <p className="text-lg font-black text-slate-800">
                  R$ {confirmModal.amount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            )}
            
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} 
                className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all"
              >
                Voltar
              </button>
              <button 
                onClick={executeAction} 
                className={`py-3 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl ${
                  confirmModal.type === 'approve' 
                    ? 'bg-green-600 hover:bg-green-700 shadow-green-600/20' 
                    : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'
                }`}
              >
                {confirmModal.type === 'approve' ? 'Confirmar Aprovação' : confirmModal.type === 'delete' ? 'Excluir Agora' : 'Confirmar Cancelamento'}
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default Purchases;
