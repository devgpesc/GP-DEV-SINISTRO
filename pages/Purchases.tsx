
import React, { useState, useMemo, useEffect } from 'react';
import { 
  ShoppingCart, Search, Filter, CheckCircle2, XCircle, Printer, MoreVertical, 
  DollarSign, UserCheck, X, Eye, EyeOff, Loader2, Info, Trash2, ShieldCheck, AlertTriangle, Truck, Calendar
} from 'lucide-react';
import { PurchaseOrder } from '../types';
import { supabase } from '../services/supabaseClient';

const Purchases: React.FC = () => {
  const [currentUserRole] = useState<'Admin' | 'Gerente' | 'User'>('Admin');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('Todos');
  const [orders, setOrders] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);
  
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [viewOrder, setViewOrder] = useState<any | null>(null);
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
    
    const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
            *,
            suppliers (
                name,
                whatsapp,
                email
            ),
            purchase_order_items (
                name,
                quantity,
                unit,
                unit_price,
                total_price
            )
        `)
        .order('created_at', { ascending: false });
    
    if (error) {
        console.error("Erro ao carregar compras:", error);
        setToast({ show: true, title: 'Erro', message: 'Falha ao buscar OCs.', type: 'info' });
    } else {
        const mappedOrders = data?.map((o: any) => ({
            id: o.id,
            code: o.code,
            eventId: o.event_id,
            supplierId: o.supplier_id,
            supplierName: o.suppliers?.name || 'Fornecedor Desconhecido',
            items: o.purchase_order_items?.map((poi: any) => ({
                name: poi.name,
                quantity: poi.quantity,
                unit: poi.unit,
                price: poi.unit_price,
                total: poi.total_price
            })) || [],
            total: o.total || 0,
            status: o.status,
            createdAt: o.created_at
        })) || [];
        setOrders(mappedOrders);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (toast?.show && toast.type !== 'loading') {
      const timer = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  const canApprove = currentUserRole === 'Admin' || currentUserRole === 'Gerente';

  const updateOrderStatus = async (id: string, newStatus: PurchaseOrder['status']) => {
    const { error } = await supabase.from('purchase_orders').update({ status: newStatus }).eq('id', id);
    if (!error) {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
    } else {
        setToast({ show: true, title: 'Erro', message: 'Falha ao atualizar status.', type: 'info' });
    }
  };

  const handleRequestApprove = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'approve',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  const handleRequestCancel = (order: any) => {
    setConfirmModal({
      isOpen: true,
      type: 'cancel',
      orderId: order.id,
      orderCode: order.code,
      amount: order.total
    });
    setOpenMenuId(null);
  };

  const handleRequestDelete = (order: any) => {
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
            setToast({ show: true, title: 'Excluído', message: `Ordem ${confirmModal.orderCode} removida.`, type: 'success' });
        } else {
            setToast({ show: true, title: 'Erro', message: 'Não foi possível excluir.', type: 'info' });
        }
      }
      setConfirmModal({ isOpen: false, type: null, orderId: null, orderCode: null });
    }
  };

  const handlePrint = (order: any) => {
    setToast({ show: true, title: 'Imprimindo', message: 'Gerando visualização...', type: 'loading' });
    
    const itemsHtml = order.items?.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #ddd;">${item.name}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: center;">${item.quantity} ${item.unit || ''}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${(item.price || 0).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #ddd; text-align: right;">R$ ${(item.total || (item.price * item.quantity)).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    const printContent = `
      <html>
        <head><title>Ordem de Compra ${order.code}</title></head>
        <body style="font-family: Arial, sans-serif; padding: 40px;">
          <h1 style="color: #2563eb;">Ordem de Compra: ${order.code}</h1>
          <p><strong>Fornecedor:</strong> ${order.supplierName}</p>
          <p><strong>Data:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
          <hr/>
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 10px; text-align: left;">Item</th>
                <th style="padding: 10px; text-align: center;">Qtd</th>
                <th style="padding: 10px; text-align: right;">Unitário</th>
                <th style="padding: 10px; text-align: right;">Total</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
          <h3 style="text-align: right; margin-top: 30px;">TOTAL: R$ ${order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</h3>
        </body>
      </html>
    `;

    const win = window.open('', '', 'width=800,height=600');
    if (win) {
        win.document.write(printContent);
        win.document.close();
        win.print();
        setToast(null);
    }
  };

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const matchSearch = o.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          o.supplierName.toLowerCase().includes(searchTerm.toLowerCase());
      const matchStatus = filterStatus === 'Todos' || o.status === filterStatus;
      return matchSearch && matchStatus;
    });
  }, [orders, searchTerm, filterStatus]);

  if (loading) return <div className="text-center py-20"><Loader2 className="animate-spin mx-auto text-blue-600" size={32}/></div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      
      {/* Toast Overlay */}
      {toast && toast.show && (
        <div className="fixed top-6 right-6 z-[120] animate-in slide-in-from-right-10 duration-300">
            <div className="bg-slate-900 text-white px-6 py-4 rounded-2xl shadow-xl flex items-center gap-4 min-w-[300px]">
                {toast.type === 'loading' ? <Loader2 className="animate-spin"/> : <Info/>}
                <div><p className="font-bold">{toast.title}</p><p className="text-xs">{toast.message}</p></div>
            </div>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800">Ordens de Compra</h2>
          <p className="text-sm text-slate-500">Pedidos gerados via matriz de cotação.</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none" 
            placeholder="Buscar OC ou Fornecedor..." 
            value={searchTerm} 
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
            {['Todos', 'Gerada', 'Aprovada', 'Cancelada'].map(st => (
                <button key={st} onClick={() => setFilterStatus(st)} className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${filterStatus === st ? 'bg-white shadow text-blue-600' : 'text-slate-500'}`}>{st}</button>
            ))}
        </div>
      </div>

      {/* Lista */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
            <div className="py-20 text-center bg-slate-50 rounded-[40px] border-2 border-dashed border-slate-200">
                <ShoppingCart className="mx-auto text-slate-300 mb-2" size={40}/>
                <p className="text-slate-400 font-bold uppercase tracking-widest">Nenhuma compra encontrada</p>
            </div>
        ) : (
            filteredOrders.map(order => (
                <div key={order.id} className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm hover:border-blue-200 transition-all group">
                    <div className="flex items-center gap-4">
                        
                        {/* 1. IDENTIFICAÇÃO DO PEDIDO (ESQUERDA) */}
                        <div className="w-16 h-16 rounded-2xl flex-shrink-0 flex items-center justify-center text-2xl font-black bg-blue-50 text-blue-600">
                            {order.status === 'Cancelada' ? <XCircle className="text-red-400"/> : <ShoppingCart/>}
                        </div>
                        
                        <div className="flex-1 min-w-0 pr-4">
                            <div className="flex items-center gap-3 mb-1">
                                <h3 className="text-lg font-black text-slate-800 whitespace-nowrap">{order.code}</h3>
                                <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase border flex-shrink-0 ${
                                    order.status === 'Aprovada' ? 'bg-green-50 text-green-600 border-green-100' : 
                                    order.status === 'Cancelada' ? 'bg-red-50 text-red-600 border-red-100' : 
                                    'bg-slate-50 text-slate-500 border-slate-100'
                                }`}>{order.status}</span>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-slate-500 font-bold">
                                <span className="flex items-center gap-1 text-slate-700 truncate max-w-[200px]"><Truck size={12} className="text-blue-400"/> {order.supplierName}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span className="flex items-center gap-1"><Calendar size={12}/> {new Date(order.createdAt).toLocaleDateString()}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                                <span>{order.items.length} itens</span>
                            </div>
                        </div>

                        {/* 2. VALOR TOTAL (ALINHADO À DIREITA COM LARGURA FIXA) */}
                        <div className="flex flex-col items-end justify-center px-8 border-l border-r border-slate-50 h-12 min-w-[200px]">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Valor Total</p>
                            <p className="text-2xl font-black text-slate-800 leading-none">R$ {order.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                        </div>

                        {/* 3. AÇÕES (DIREITA) */}
                        <div className="flex gap-2 pl-2 flex-shrink-0">
                            {order.status === 'Gerada' && canApprove && (
                                <button onClick={() => handleRequestApprove(order)} className="bg-green-600 text-white px-4 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-green-700 transition-all shadow-lg shadow-green-600/20 flex items-center gap-2" title="Aprovar OC">
                                    <ShieldCheck size={16}/>
                                </button>
                            )}
                            <button onClick={() => setViewOrder(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm" title="Ver Detalhes"><Eye size={18}/></button>
                            <button onClick={() => handlePrint(order)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-blue-600 rounded-xl hover:border-blue-200 transition-all shadow-sm" title="Imprimir"><Printer size={18}/></button>
                            
                            <div className="relative">
                                <button onClick={() => setOpenMenuId(openMenuId === order.id ? null : order.id)} className="p-3 bg-white border border-slate-100 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-50 transition-all shadow-sm"><MoreVertical size={18}/></button>
                                {openMenuId === order.id && (
                                    <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in duration-200">
                                        {order.status !== 'Cancelada' && <button onClick={() => handleRequestCancel(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-amber-600 hover:bg-amber-50 border-b border-slate-50">Cancelar OC</button>}
                                        <button onClick={() => handleRequestDelete(order)} className="w-full text-left px-4 py-3 text-xs font-bold text-red-600 hover:bg-red-50">Excluir Registro</button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            ))
        )}
      </div>

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
                        <thead><tr><th className="pb-2 text-xs font-black text-slate-400 uppercase">Item</th><th className="pb-2 text-center text-xs font-black text-slate-400 uppercase">Qtd</th><th className="pb-2 text-right text-xs font-black text-slate-400 uppercase">Total</th></tr></thead>
                        <tbody className="divide-y divide-slate-100">
                            {viewOrder.items?.map((item: any, idx: number) => (
                                <tr key={idx}>
                                    <td className="py-3 text-sm font-bold text-slate-700">{item.name}</td>
                                    <td className="py-3 text-center text-sm font-medium text-slate-500">{item.quantity} {item.unit || ''}</td>
                                    <td className="py-3 text-right text-sm font-bold text-slate-800">R$ {(item.total || (item.price * item.quantity)).toFixed(2)}</td>
                                </tr>
                            ))}
                        </tbody>
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
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => setConfirmModal({ ...confirmModal, isOpen: false })} className="py-3 bg-slate-100 rounded-2xl font-black text-xs uppercase text-slate-500">Voltar</button>
              <button onClick={executeAction} className={`py-3 text-white rounded-2xl font-black text-xs uppercase ${confirmModal.type === 'approve' ? 'bg-green-600' : 'bg-red-500'}`}>Confirmar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Purchases;
