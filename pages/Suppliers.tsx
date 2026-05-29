
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Star, MessageCircle, MapPin, X, 
  LayoutGrid, List, Edit, Trash2, Shield, Loader2, 
  TrendingUp, Clock, Globe, User, Mail, Phone, AlertTriangle, Home,
  History, Send, ThumbsUp, Truck
} from 'lucide-react';
import { Supplier } from '../types';
import { supabase } from '../services/supabaseClient';
import { lookupService } from '../services/lookupService';
import ActionModal from '../components/ActionModal';
import { useToast } from '../context/ToastContext';
import { useAuth } from '../context/AuthContext';

// Componente Interno de Estrelas Interativas
const StarRatingInput = ({ value, onChange, readonly = false, size = 24 }: { value: number, onChange?: (val: number) => void, readonly?: boolean, size?: number }) => {
  const [hoverValue, setHoverValue] = useState<number | null>(null);

  return (
    <div className="flex items-center gap-1" onMouseLeave={() => setHoverValue(null)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (hoverValue !== null ? hoverValue : value) >= star;
        return (
          <button
            key={star}
            type="button"
            disabled={readonly}
            onClick={() => onChange && onChange(star)}
            onMouseEnter={() => !readonly && setHoverValue(star)}
            className={`transition-all duration-200 ${readonly ? 'cursor-default' : 'cursor-pointer hover:scale-110'}`}
          >
            <Star 
              size={size} 
              className={`${isFilled ? 'text-amber-400 fill-amber-400' : 'text-slate-300'}`} 
              strokeWidth={isFilled ? 0 : 1.5}
            />
          </button>
        );
      })}
      {!readonly && <span className="ml-2 text-xs font-bold text-slate-400 w-8">{hoverValue ?? value}.0</span>}
    </div>
  );
};

interface Review {
  id: string;
  rating: number;
  comment: string;
  created_at: string;
  user_id: string;
  profiles?: { full_name: string };
}

const Suppliers: React.FC = () => {
  const { addToast } = useToast();
  const { user, currentTenant, isSuperAdmin } = useAuth();
  
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [dbError, setDbError] = useState<{message: string} | null>(null);
  
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [isLookingCep, setIsLookingCep] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  
  // Form Principal
  const [formData, setFormData] = useState({
    name: '', cnpj: '', segment: 'Peças' as any, whatsapp: '', email: '', 
    cep: '', address: '', city: '', status: 'Ativo' as any, rating: 5, contactName: ''
  });

  // Form de Nova Avaliação
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });

  useEffect(() => {
    loadSuppliers();
  }, [currentTenant?.id, isSuperAdmin]);

  useEffect(() => {
    if (activeTab === 'history' && supplierToEdit) {
      loadReviews(supplierToEdit.id);
    }
  }, [activeTab, supplierToEdit]);

  async function loadSuppliers() {
    setLoading(true);
    setDbError(null);
    try {
        if (!currentTenant?.id && !isSuperAdmin) {
          setSuppliers([]);
          return;
        }

        let query = supabase.from('suppliers').select('*').order('created_at', { ascending: false });
        if (currentTenant?.id) query = query.eq('tenant_id', currentTenant.id);
        let { data, error } = await query;
        
        if (error) {
            if (error.message?.includes('does not exist') || error.code === '42703') {
                 let retryQuery = supabase.from('suppliers').select('*');
                 if (currentTenant?.id) retryQuery = retryQuery.eq('tenant_id', currentTenant.id);
                 const retry = await retryQuery;
                 data = retry.data;
                 error = retry.error as any;
            }
        }
        
        if (error) throw error;

        const mappedData = data?.map((s: any) => ({
            ...s,
            contactName: s.contact_name || s.contactName
        })) || [];
        setSuppliers(mappedData);
    } catch (e: any) {
        setDbError({ message: e.message });
    } finally {
        setLoading(false);
    }
  }

  async function loadReviews(supplierId: string) {
    setLoadingReviews(true);
    try {
      const { data, error } = await supabase
        .from('supplier_reviews')
        .select('*, profiles(full_name)')
        .eq('supplier_id', supplierId)
        .eq('tenant_id', currentTenant?.id || supplierToEdit?.tenant_id || '')
        .order('created_at', { ascending: false });
      
      if (!error) {
        setReviews(data || []);
      }
    } catch (e) {
      console.error("Erro reviews", e);
    } finally {
      setLoadingReviews(false);
    }
  }

  const handleEdit = (s: Supplier) => {
    setSupplierToEdit(s);
    setFormData({ 
      name: s.name,
      cnpj: s.cnpj,
      segment: s.segment,
      whatsapp: s.whatsapp,
      email: s.email || '',
      cep: (s as any).cep || '',
      address: (s as any).address || '',
      city: s.city,
      status: s.status,
      rating: s.rating,
      contactName: s.contactName || ''
    });
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const handleCreate = () => {
    setSupplierToEdit(null);
    setFormData({name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', cep: '', address: '', city: '', status: 'Ativo', rating: 5, contactName: ''});
    setActiveTab('details');
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      let query = supabase.from('suppliers').delete().eq('id', deleteId);
      if (currentTenant?.id) query = query.eq('tenant_id', currentTenant.id);
      const { error } = await query;
      if (!error) {
          setSuppliers(prev => prev.filter(s => s.id !== deleteId));
          addToast('success', 'Excluído', 'Fornecedor removido.');
      } else {
          addToast('error', 'Erro', 'Não foi possível excluir.');
      }
      setDeleteId(null);
    }
  };

  // ... (Manter handleCepLookup e handleCNPJLookup inalterados) ...
  const handleCepLookup = async () => {
    const cleanCep = formData.cep.replace(/\D/g, '');
    if (cleanCep.length < 8) return;
    setIsLookingCep(true);
    try {
        const response = await fetch(`https://viacep.com.br/ws/${cleanCep}/json/`);
        const data = await response.json();
        if (!data.erro) {
            setFormData(prev => ({ ...prev, address: `${data.logradouro}, ${data.bairro}`, city: `${data.localidade} - ${data.uf}` }));
        }
    } catch (e) { console.error(e); } finally { setIsLookingCep(false); }
  };

  const handleCNPJLookup = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length < 14) return;
    setIsLookingUp(true);
    setLookupMessage('Buscando...');
    try {
      const data = await lookupService.fetchCNPJ(cleanCnpj);
      if (data) {
        setFormData(prev => ({ ...prev, name: data.name || data.fantasy || prev.name, city: data.city || prev.city, email: data.email || prev.email, whatsapp: data.phone || prev.whatsapp }));
        setLookupMessage('Encontrado!');
      } else {
        setLookupMessage('Não encontrado.');
      }
    } catch (e) { setLookupMessage('Erro API.'); } finally { setIsLookingUp(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    if (!currentTenant?.id && !isSuperAdmin) {
      addToast('error', 'Empresa obrigatoria', 'Selecione uma empresa antes de salvar fornecedores.');
      setIsSaving(false);
      return;
    }

    const payload = {
        tenant_id: currentTenant?.id || supplierToEdit?.tenant_id,
        name: formData.name,
        cnpj: formData.cnpj.replace(/\D/g, ''),
        segment: formData.segment,
        whatsapp: formData.whatsapp,
        email: formData.email,
        city: formData.city,
        address: formData.address,
        cep: formData.cep,
        status: formData.status,
        rating: formData.rating,
        contact_name: formData.contactName,
    };

    try {
        let error;
        if (supplierToEdit) {
            let query = supabase.from('suppliers').update(payload).eq('id', supplierToEdit.id);
            if (currentTenant?.id) query = query.eq('tenant_id', currentTenant.id);
            const res = await query;
            error = res.error;
        } else {
            const res = await supabase.from('suppliers').insert([payload]);
            error = res.error;
        }

        if (error) throw error;

        await loadSuppliers();
        setIsModalOpen(false);
        addToast('success', 'Salvo', 'Fornecedor salvo com sucesso.');
    } catch (err: any) {
        addToast('error', 'Erro ao Salvar', err.message);
    } finally {
        setIsSaving(false);
    }
  };

  const handleAddReview = async () => {
    if (!supplierToEdit || !user) return;
    const reviewTenantId = currentTenant?.id || supplierToEdit.tenant_id;
    if (!reviewTenantId) {
        addToast('error', 'Empresa obrigatoria', 'Selecione uma empresa antes de avaliar fornecedores.');
        return;
    }
    if (!newReview.comment.trim()) {
        addToast('warning', 'Comentário vazio', 'Por favor descreva a experiência.');
        return;
    }

    setIsSaving(true);
    try {
        // 1. Inserir Review
        const { error } = await supabase.from('supplier_reviews').insert([{
            tenant_id: reviewTenantId,
            supplier_id: supplierToEdit.id,
            user_id: user.id,
            rating: newReview.rating,
            comment: newReview.comment
        }]);

        if (error) throw error;

        // 2. Recalcular Média (Frontend Simples ou Backend Function - aqui faremos via código)
        // Busca todas as reviews atualizadas
        const { data: allReviews } = await supabase
          .from('supplier_reviews')
          .select('rating')
          .eq('supplier_id', supplierToEdit.id)
          .eq('tenant_id', reviewTenantId);
        
        let newAverage = newReview.rating;
        if (allReviews && allReviews.length > 0) {
            const sum = allReviews.reduce((acc, r) => acc + r.rating, 0);
            newAverage = sum / allReviews.length;
        }

        // 3. Atualizar Fornecedor
        await supabase
          .from('suppliers')
          .update({ rating: newAverage })
          .eq('id', supplierToEdit.id)
          .eq('tenant_id', reviewTenantId);

        addToast('success', 'Avaliação Registrada', 'O desempenho do fornecedor foi atualizado.');
        setNewReview({ rating: 5, comment: '' });
        await loadReviews(supplierToEdit.id);
        
        // Atualiza a lista principal e o form atual
        setSuppliers(prev => prev.map(s => s.id === supplierToEdit.id ? { ...s, rating: newAverage } : s));
        setFormData(prev => ({ ...prev, rating: newAverage }));

    } catch (e: any) {
        addToast('error', 'Erro', e.message);
    } finally {
        setIsSaving(false);
    }
  };

  const filtered = useMemo(() => {
    return suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.cnpj.includes(searchTerm));
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6">
      {/* Header e Filtros */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar por nome ou CNPJ..." className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex items-center gap-3">
            <div className="flex bg-slate-100 p-1 rounded-xl">
               <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18}/></button>
               <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List size={18}/></button>
            </div>
            <button onClick={handleCreate} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-500/20 whitespace-nowrap">
              <Plus size={18} /> Novo Parceiro
            </button>
        </div>
      </div>

      {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
              {filtered.map(s => (
                  <div 
                    key={s.id} 
                    onClick={() => handleEdit(s)}
                    className="bg-white p-6 rounded-[32px] border border-slate-200 hover:border-blue-200 transition-all shadow-sm group relative cursor-pointer"
                  >
                      <div className="flex justify-between items-start mb-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg bg-indigo-50 text-indigo-600`}>
                              <Truck size={24}/>
                          </div>
                          <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${s.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                              {s.status}
                          </span>
                      </div>
                      
                      <h3 className="font-black text-slate-800 text-lg mb-1 truncate" title={s.name}>{s.name}</h3>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">{s.cnpj}</p>
                      
                      <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                          <p className="text-xs font-bold text-slate-500 flex items-center gap-1 uppercase"><MapPin size={12}/> {s.city}</p>
                          <div className="flex items-center gap-1 text-amber-500">
                              <Star size={14} fill="currentColor"/>
                              <span className="text-xs font-black text-slate-700">{Number(s.rating).toFixed(1)}</span>
                          </div>
                      </div>

                      <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit size={18}/></button>
                          <button onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
                      </div>
                  </div>
              ))}
          </div>
      ) : (
          <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Avaliação</th>
                  <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map(s => (
                  <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => handleEdit(s)}>
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-800">{s.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold">{s.cnpj}</p>
                    </td>
                    <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{s.city}</td>
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-1 text-amber-500">
                          <Star size={14} fill="currentColor"/>
                          <span className="text-xs font-black text-slate-700">{Number(s.rating).toFixed(1)}</span>
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right flex justify-end gap-2">
                      <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit size={18}/></button>
                      <button onClick={(e) => { e.stopPropagation(); setDeleteId(s.id); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] flex flex-col">
            
            {/* Header com Tabs */}
            <div className="bg-slate-50 border-b border-slate-100">
                <div className="p-8 pb-0 flex justify-between items-start">
                    <div>
                        <h3 className="text-2xl font-black text-slate-800 tracking-tight">{supplierToEdit ? 'Gerenciar Parceiro' : 'Novo Parceiro'}</h3>
                        <p className="text-xs text-slate-400 font-medium mt-1 mb-6">Módulo de cadastro e performance.</p>
                    </div>
                    <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-300 hover:text-slate-500"><X size={28}/></button>
                </div>
                <div className="flex px-8 gap-6">
                    <button onClick={() => setActiveTab('details')} className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'details' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                        Dados Cadastrais
                    </button>
                    {supplierToEdit && (
                        <button onClick={() => setActiveTab('history')} className={`pb-4 text-xs font-black uppercase tracking-widest border-b-2 transition-all ${activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                            Histórico & Desempenho
                        </button>
                    )}
                </div>
            </div>

            {/* Content Scrollable */}
            <div className="flex-1 overflow-y-auto p-8">
                
                {/* ABA 1: DETALHES */}
                {activeTab === 'details' && (
                    <form id="supplierForm" onSubmit={handleSave} className="space-y-6">
                        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                            {/* ...Inputs existentes... */}
                            <div className="col-span-2">
                                <label className="flex justify-between items-end text-[10px] font-black uppercase text-slate-400 mb-2">
                                    <span>CNPJ / CPF *</span>
                                    {lookupMessage && <span className="text-blue-500 flex items-center gap-1">{isLookingUp && <Loader2 className="animate-spin" size={10}/>} {lookupMessage}</span>}
                                </label>
                                <div className="relative">
                                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                                    <input required className="w-full pl-12 pr-12 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} onBlur={handleCNPJLookup} placeholder="00.000.000/0001-00"/>
                                    <button type="button" onClick={handleCNPJLookup} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600"><Globe size={18}/></button>
                                </div>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Razão Social *</label>
                                <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Endereço (CEP)</label>
                                <div className="flex gap-4">
                                    <input className="w-40 pl-4 pr-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.cep} onChange={e => setFormData({...formData, cep: e.target.value})} onBlur={handleCepLookup} placeholder="CEP" />
                                    <input className="flex-1 p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.address} onChange={e => setFormData({...formData, address: e.target.value})} placeholder="Rua, Número" />
                                </div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Cidade *</label>
                                <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Contato</label>
                                <input className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Email</label>
                                <input type="email" className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                            </div>
                            <div>
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">WhatsApp</label>
                                <input className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
                            </div>
                            
                            {/* COMPONENTE DE RATING PRINCIPAL */}
                            <div className="col-span-2 pt-4 border-t border-slate-100">
                                <label className="block text-[10px] font-black uppercase text-slate-400 mb-3 tracking-widest">Avaliação Geral Inicial</label>
                                <div className="p-6 bg-[#F8FAFC] border border-slate-100 rounded-3xl flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 bg-white rounded-2xl shadow-sm border border-slate-100">
                                            <TrendingUp size={24} className="text-blue-600"/>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">Reputação</p>
                                            <p className="text-xs text-slate-400">Nota visível nas cotações</p>
                                        </div>
                                    </div>
                                    <StarRatingInput 
                                        value={Number(formData.rating)} 
                                        onChange={(val) => setFormData({...formData, rating: val})}
                                        size={32}
                                    />
                                </div>
                            </div>
                        </div>
                    </form>
                )}

                {/* ABA 2: HISTÓRICO */}
                {activeTab === 'history' && (
                    <div className="space-y-8 animate-in slide-in-from-right-4 duration-300">
                        {/* Box de Nova Avaliação */}
                        <div className="bg-blue-50/50 p-6 rounded-[32px] border border-blue-100">
                            <h4 className="text-sm font-black text-blue-800 flex items-center gap-2 mb-4"><ThumbsUp size={18}/> Registrar Nova Experiência</h4>
                            <div className="flex flex-col gap-4">
                                <div className="flex items-center gap-4">
                                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wide">Nota:</span>
                                    <StarRatingInput value={newReview.rating} onChange={(v) => setNewReview({...newReview, rating: v})} size={24} />
                                </div>
                                <div className="relative">
                                    <textarea 
                                        className="w-full p-4 bg-white border border-blue-100 rounded-2xl text-sm font-medium outline-none focus:ring-2 focus:ring-blue-200 resize-none h-24"
                                        placeholder="Descreva como foi a entrega, qualidade das peças, pontualidade..."
                                        value={newReview.comment}
                                        onChange={e => setNewReview({...newReview, comment: e.target.value})}
                                    />
                                    <button 
                                        onClick={handleAddReview}
                                        disabled={isSaving}
                                        className="absolute bottom-3 right-3 p-2 bg-blue-600 text-white rounded-xl shadow-lg hover:bg-blue-700 transition-all disabled:opacity-50"
                                    >
                                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : <Send size={16}/>}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Lista de Avaliações */}
                        <div>
                            <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><History size={14}/> Histórico Recente</h4>
                            {loadingReviews ? (
                                <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-slate-300"/></div>
                            ) : reviews.length === 0 ? (
                                <div className="text-center py-10 text-slate-400 border-2 border-dashed border-slate-100 rounded-3xl">Nenhuma avaliação registrada ainda.</div>
                            ) : (
                                <div className="space-y-4">
                                    {reviews.map(review => (
                                        <div key={review.id} className="p-5 bg-white border border-slate-100 rounded-3xl shadow-sm hover:shadow-md transition-all">
                                            <div className="flex justify-between items-start mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-bold text-xs">
                                                        {review.profiles?.full_name?.charAt(0) || 'U'}
                                                    </div>
                                                    <div>
                                                        <p className="text-xs font-bold text-slate-800">{review.profiles?.full_name || 'Usuário'}</p>
                                                        <p className="text-[10px] text-slate-400">{new Date(review.created_at).toLocaleDateString()}</p>
                                                    </div>
                                                </div>
                                                <StarRatingInput value={review.rating} readonly size={14} />
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed font-medium">{review.comment}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {activeTab === 'details' && (
                <div className="p-6 border-t border-slate-50 flex justify-end gap-4 bg-white">
                    <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-black uppercase text-[11px] tracking-widest hover:text-slate-600">Cancelar</button>
                    <button type="submit" form="supplierForm" disabled={isSaving} className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-600/20 uppercase text-xs tracking-widest hover:bg-blue-700 flex items-center gap-2">
                        {isSaving ? <Loader2 className="animate-spin" size={16}/> : 'Salvar Fornecedor'}
                    </button>
                </div>
            )}
          </div>
        </div>
      )}

      <ActionModal 
        isOpen={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={confirmDelete}
        title="Excluir Parceiro?" description="Remover este fornecedor apagará seus dados." type="danger" confirmText="Sim, excluir"
      />
    </div>
  );
};

export default Suppliers;
