
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Search, Filter, CheckCircle2, XCircle, Printer, MoreVertical, 
  DollarSign, UserCheck, X, Eye, EyeOff, Loader2, Info, Trash2, Package, ShieldCheck, AlertTriangle
} from 'lucide-react';
import { PurchaseOrder } from '../types';
import { supabase } from '../services/supabaseClient';

const Purchases: React.FC = () => {
  const [currentUserRole] = useState<'Admin' | 'Gerente' | 'User'>('Admin');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<PurchaseOrder | null>(null);
  const [toast, setToast] = useState<{ show: boolean; title: string; message: string; type: 'success' | 'info' | 'loading' } | null>(null);

  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    type: 'approve' | 'cancel' | 'delete' | null;
    orderId: string | null;
    orderCode: string | null;
    amount?: number;
  }>({ isOpen: false, type: null, orderId: null, orderCode: null });

  useEffect(() => {
    loadOrders();
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    // QUERY CORRIGIDA: Ordenação por created_at (snake_case)
    const { data, error } = await supabase
        .from('purchase_orders')
        .select('*')
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao carregar compras:", error);
        setToast({ show: true, title: 'Erro de Carregamento', message: 'Não foi possível buscar as OCs.', type: 'info' });
    } else {
        // Mapeamento para garantir compatibilidade com a interface PurchaseOrder (que usa camelCase)
        const mappedOrders = data?.map((o: any) => ({
            ...o,
            eventId: o.event_id || o.eventId,
            supplierId: o.supplier_id || o.supplierId,
            createdAt: o.created_at || o.createdAt,
            // items já vem como JSONB array
        })) || [];
        setOrders(mappedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

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

  const updateOrderStatus = async (id: string, newStatus: PurchaseOrder['status']) => {
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', id);
    if (!error) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } else {
        setToast({ show: true, title: 'Erro', message: 'Falha ao atualizar status.', type: 'info' });
    }
  };

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

  const executeAction = async () => {
    if (confirmModal.orderId && confirmModal.type) {
      if (confirmModal.type === 'approve') {
        await updateOrderStatus(confirmModal.orderId, 'Aprovada');
        setToast({ show: true, title: 'Sucesso', message: `Ordem ${confirmModal.orderCode} aprovada.`, type: 'success' });
      } else if (confirmModal.type === 'cancel') {
        await updateOrderStatus(confirmModal.orderId, 'Cancelada');
        setToast({ show: true, title: 'Cancelado', message: `Ordem ${confirmModal.orderCode} foi cancelada.`, type: 'info' });
      } else if (confirmModal.type === 'delete') {
        const { error } = await supabase.from('purchase_orders').delete().eq('id', confirmModal.orderId);
        if (!error) {
            setOrders(prev => prev.filter(o => o.id !== confirmModal.orderId));
            setToast({ show: true, title: 'Excluído', message: `Ordem ${confirmModal.orderCode} removida permanentemente.`, type: 'success' });
        }
      }
      setConfirmModal({ isOpen: false, type: null, orderId: null, orderCode: null });
    }
  };

  const handlePrint = (order: PurchaseOrder) => {
    setToast({ 
        show: true, 
        title: 'Gerando PDF', 
        message: `Preparando documento ${order.code} para impressão...`, 
        type: 'loading' 
    });

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
            table { width: 100%; border-collapse: collapse; margin-bottom: 30px; font-size: 13px; }
            th { background: #1e293b; color: white; text-align: left; padding: 12px; text-transform: uppercase; font-size: 11px; letter-spacing: 1px; }
            .totals { display: flex; justify-content: flex-end; }
            .totals-box { width: 250px; }
            .row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #eee; }
            .row.final { border-top: 2px solid #333; border-bottom: none; margin-top: 10px; padding-top: 15px; font-size: 18px; font-weight: bold; color: #2563eb; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="logo"><h1>AutoClaims Pro</h1><p>Sistema de Gestão</p></div>
            <div class="meta"><h2>${order.code}</h2><p>EMISSÃO: ${new Date(order.createdAt).toLocaleDateString()}</p><span class="status-badge">${order.status}</span></div>
          </div>
          <table><thead><tr><th width="50%">Descrição</th><th width="10%">Qtd</th><th width="20%">Unit.</th><th width="20%">Total</th></tr></thead><tbody>${itemsHtml}</tbody></table>
          <div class="totals"><div class="totals-box"><div class="row final"><span>TOTAL</span><span>R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div></div>
        </body>
      </html>
    `;

    setTimeout(() => {
        setToast({ show: true, title: 'Pronto', message: 'Janela de impressão aberta.', type: 'success' });
        const printWindow = window.open('', '_blank', 'width=900,height=800');
        if (printWindow) {
            printWindow.document.write(printContent);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
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

  if (loading) return <div className="text-center py-20"><Loader2 className="animate-spin text-blue-600 mx-auto" size={40}/></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Toast */}
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
                {toast.type !== 'loading' && <button onClick={() => setToast(null)}><X size={18}/></button>}
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Ordens de Compra</h2>
          <p className="text-sm text-slate-500 font-medium">Controle e aprovação de pedidos para fornecedores.</p>
        </div>

        {canSeeValues && (
          <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center gap-6 min-w-[280px]">
            <div className="bg-green-50 p-4 rounded-2xl text-green-600 shadow-inner"><DollarSign size={28} /></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">Total Comprometido</p>
              <p className="text-2xl font-black text-slate-800 tracking-tighter">R$ {totalMonth.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
            </div>
          </div>
        )}
      </div>

      {/* Busca */}
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
        <button onClick={() => setShowFilters(!showFilters)} className={`flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest transition-all ${showFilters ? 'bg-slate-900 text-white shadow-xl' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
            <Filter size={18} /> Filtros
        </button>
        {showFilters && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-slate-200 rounded-[32px] shadow-2xl p-6 z-30">
            <div className="flex gap-2">
                {['Todos', 'Gerada', 'Aprovada', 'Enviada', 'Cancelada'].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${filterStatus === s ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-500'}`}>{s}</button>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filteredOrders.length > 0 ? filteredOrders.map(order => (
          <div key={order.id} className="bg-white p-4 md:p-6 rounded-[32px] shadow-sm border border-slate-100 hover:border-blue-200 transition-all flex flex-col md:flex-row items-center gap-6 group">
            <div className="flex items-center gap-5 w-full md:w-auto">
              <div className={`w-16 h-16 rounded-[20px] flex items-center justify-center border shadow-sm ${order.status === 'Cancelada' ? 'bg-red-50 text-red-400 border-red-100' : 'bg-blue-50 text-blue-600 border-blue-100'}`}>
                {order.status === 'Cancelada' ? <XCircle size={28}/> : <ShoppingCart size={28} />}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-1.5">
                  <h3 className={`font-black text-xl tracking-tight ${order.status === 'Cancelada' ? 'text-slate-400 line-through' : 'text-slate-800'}`}>{order.code}</h3>
                  <span className={`px-4 py-1 rounded-full text-[9px] font-black uppercase border ${getStatusStyle(order.status)}`}>{order.status}</span>
                </div>
                <p className="text-[11px] text-slate-500 font-bold uppercase">Emissão: {new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
            </div>

            <div className="flex flex-1 w-full justify-between items-center md:px-10 gap-4">
              <div className="flex-1 text-center">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Valor Total</p>
                <p className={`text-sm font-black ${canSeeValues ? 'text-green-600' : 'text-slate-300'}`}>{canSeeValues ? `R$ ${order.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '••••••'}</p>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5">Itens</p>
                <p className="text-sm font-black text-slate-800">{order.items?.length || '-'} un</p>
              </div>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto justify-end border-t md:border-t-0 pt-4 md:pt-0">
              {order.status === 'Gerada' && (
                <button onClick={() => handleRequestApprove(order)} className={`flex items-center gap-2 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl ${canApprove ? 'bg-green-600 text-white hover:bg-green-700' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}>
                  <UserCheck size={18} /> Aprovar
                </button>
              )}
              
              <div className="flex items-center gap-1">
                <button onClick={() => handlePrint(order)} className="p-3 text-slate-400 hover:text-blue-600 rounded-xl transition-all"><Printer size={20}/></button>
                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === order.id ? null : order.id); }} className={`p-3 rounded-xl transition-all ${openMenuId === order.id ? 'bg-slate-900 text-white' : 'text-slate-400 hover:text-slate-600'}`}><MoreVertical size={20}/></button>
                  {openMenuId === order.id && (
                    <div className="absolute right-0 bottom-full mb-2 w-56 bg-white border border-slate-100 rounded-2xl shadow-2xl z-20 overflow-hidden">
                        <button onClick={() => { setViewOrder(order); setOpenMenuId(null); }} className="w-full px-5 py-3 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-50"><Eye size={16}/> Visualizar Itens</button>
                        {order.status !== 'Cancelada' && <button onClick={() => handleRequestCancel(order)} className="w-full px-5 py-3 text-left text-xs font-bold text-amber-600 hover:bg-amber-50 flex items-center gap-3 border-b border-slate-50"><XCircle size={16}/> Cancelar OC</button>}
                        <button onClick={() => handleRequestDelete(order)} className="w-full px-5 py-3 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-3"><Trash2 size={16}/> Excluir Registro</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )) : (
          <div className="py-24 text-center space-y-4 bg-slate-50 rounded-[48px] border-4 border-dashed border-slate-100">
             <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto text-slate-200 shadow-inner"><ShoppingCart size={40} /></div>
             <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhuma ordem de compra encontrada</p>
          </div>
        )}
      </div>

      {!canSeeValues && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 bg-slate-900 text-white px-8 py-4 rounded-full shadow-2xl flex items-center gap-3 animate-bounce">
           <EyeOff size={18} className="text-amber-400" />
           <p className="text-xs font-black uppercase tracking-widest">Modo Restrito: Valores ocultos.</p>
        </div>
      )}

      {/* Modal Visualizar Itens */}
      {viewOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setViewOrder(null)}></div>
            <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h3 className="text-xl font-black text-slate-800">Itens da Compra ({viewOrder.code})</h3>
                    <button onClick={() => setViewOrder(null)}><X size={20}/></button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    <table className="w-full text-left">
                        <thead><tr><th>Item</th><th className="text-center">Qtd</th><th className="text-right">Total</th></tr></thead>
                        <tbody>{viewOrder.items?.map((item, idx) => (
                            <tr key={idx}><td className="py-2">{item.name}</td><td className="text-center">{item.quantity}</td><td className="text-right">R$ {(item.price * item.quantity).toFixed(2)}</td></tr>
                        ))}</tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* Modal Confirmação */}
      {confirmModal.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${confirmModal.type === 'approve' ? 'bg-green-50 text-green-500' : 'bg-red-50 text-red-500'}`}>
              {confirmModal.type === 'approve' ? <ShieldCheck size={40} /> : <AlertTriangle size={40} />}
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Confirmar Ação?</h3>
            <p className="text-sm text-slate-500 mb-6">{confirmModal.type === 'approve' ? 'Aprovar OC financeiramente.' : 'Esta ação é irreversível.'}</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase">Voltar</button>
              <button onClick={executeAction} className={`py-3 text-white rounded-2xl font-black text-xs uppercase ${confirmModal.type === 'approve' ? 'bg-green-600' : 'bg-red-500'}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
