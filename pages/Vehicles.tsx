
import React, { useState, useEffect, useRef } from 'react';
import { 
  Plus, Search, Car, Loader2, User, LayoutGrid, List, 
  Edit, Save, AlertCircle, X, CloudLightning, Keyboard, Calendar, Palette, RefreshCw,
  Trash2, CheckSquare, Square, Check
} from 'lucide-react';
import { lookupService } from '../services/lookupService';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import { Vehicle } from '../types';

interface Associate {
  id: string;
  name: string;
  document: string;
}

const Vehicles: React.FC = () => {
  const { addToast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [itemsToDelete, setItemsToDelete] = useState<string[]>([]); // IDs to delete

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [inputMode, setInputMode] = useState<'auto' | 'manual'>('auto');
  
  // Ref para timeout de segurança
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Inicialização completa do formulário
  const initialFormState = {
    plate: '', associate_id: '', km: 0, status: 'Ativo' as any, notes: '', 
    brand: '', model: '', version: '', year_fab: '', year_model: '', 
    color: '', fuel: '', type: '', chassi: '', renavam: '', uf: '', city: ''
  };

  const [formData, setFormData] = useState<Partial<Vehicle>>(initialFormState);
  const [editId, setEditId] = useState<string | null>(null);

  useEffect(() => {
    loadData();
    return () => {
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    };
  }, []);

  const loadData = async () => {
    setLoading(true);
    // Limpa seleção ao recarregar
    setSelectedIds([]);

    // Timeout de segurança: Se travar por 8s, libera a tela
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
    loadingTimeoutRef.current = setTimeout(() => {
        setLoading((prev) => {
            if (prev) {
                console.warn('Timeout de carregamento forçado.');
                return false;
            }
            return prev;
        });
    }, 8000);

    try {
      // 1. Carregar Associados (Independente)
      const { data: as, error: aError } = await supabase.from('associates').select('id, name, document');
      if (aError) console.warn("Aviso ao buscar associados:", aError.message);
      setAssociates(as || []);

      // 2. Carregar Veículos (Tentativa com Ordem, Fallback sem Ordem)
      let vsData = null;
      let vsError = null;

      // Tentativa 1: Com ordenação
      const resOrdered = await supabase.from('vehicles').select('*').order('created_at', { ascending: false });
      
      if (resOrdered.error) {
          console.warn("Falha na ordenação (coluna created_at pode não existir). Tentando sem ordem.");
          // Tentativa 2: Sem ordenação
          const resUnordered = await supabase.from('vehicles').select('*');
          vsData = resUnordered.data;
          vsError = resUnordered.error;
      } else {
          vsData = resOrdered.data;
      }

      if (vsError) throw vsError;

      // Normalização de dados (Resiliência para snake_case vs camelCase)
      const mappedVehicles = vsData?.map((v: any) => ({
        ...v,
        associate_id: v.associate_id || v.associateId, 
        year_fab: v.year_fab || v.yearFab,
        year_model: v.year_model || v.yearModel,
        plate: v.plate || '---'
      })) || [];

      setVehicles(mappedVehicles);
      
    } catch (err: any) {
      console.error("Erro ao carregar dados de veículos:", err);
      // Se for erro de tabela inexistente, não mostra toast de erro grave, apenas vazio
      if (!err.message?.includes('does not exist')) {
          addToast('error', 'Erro de Carregamento', 'Não foi possível listar os veículos. Verifique sua conexão.');
      }
    } finally {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
      setLoading(false);
    }
  };

  // --- DELETE LOGIC ---

  const handleSelection = (id: string) => {
    if (selectedIds.includes(id)) {
        setSelectedIds(selectedIds.filter(i => i !== id));
    } else {
        setSelectedIds([...selectedIds, id]);
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredVehicles.length) {
        setSelectedIds([]);
    } else {
        setSelectedIds(filteredVehicles.map(v => v.id));
    }
  };

  const promptDelete = (ids: string[]) => {
      setItemsToDelete(ids);
      setShowDeleteModal(true);
  };

  const executeDelete = async () => {
      setIsDeleting(true);
      try {
          // 1. Tenta deletar
          const { error } = await supabase.from('vehicles').delete().in('id', itemsToDelete);
          
          if (error) {
              // Verifica erro de Foreign Key (Restrição)
              if (error.code === '23503') { // foreign_key_violation
                  throw new Error('Não é possível excluir veículos que possuem sinistros ou ordens de serviço vinculadas.');
              }
              throw error;
          }

          // 2. Atualiza UI
          setVehicles(prev => prev.filter(v => !itemsToDelete.includes(v.id)));
          setSelectedIds([]);
          addToast('success', 'Excluído', `${itemsToDelete.length} veículo(s) removido(s).`);
          setShowDeleteModal(false);

      } catch (err: any) {
          console.error(err);
          addToast('error', 'Erro ao Excluir', err.message);
          setShowDeleteModal(false); // Fecha modal mesmo com erro para não travar, usuário lê o toast
      } finally {
          setIsDeleting(false);
      }
  };

  // --- END DELETE LOGIC ---

  const handleOpenModal = (vehicleToEdit?: Vehicle) => {
    if (vehicleToEdit) {
      setEditId(vehicleToEdit.id);
      setFormData(vehicleToEdit);
      setInputMode('manual'); 
    } else {
      setEditId(null);
      setFormData(initialFormState);
      setInputMode('auto');
    }
    setIsModalOpen(true);
  };

  const handlePlateLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) return;
    setIsSearchingPlate(true);
    setLookupError(null);
    
    try {
      const data = await lookupService.fetchPlate(formData.plate);
      if (data) {
        setFormData(prev => ({ 
            ...prev, 
            ...data
        }));
        addToast('success', 'Placa Encontrada', 'Dados do veículo carregados.');
      } else {
        setLookupError('Placa não encontrada. Preencha manualmente.');
      }
    } catch (e) {
      setLookupError('Erro de conexão.');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  // Função auxiliar para salvar (tenta payload, se falhar, tenta fallback)
  const performSave = async (payload: any, isRetry = false): Promise<any> => {
      if (editId) {
          return await supabase.from('vehicles').update(payload).eq('id', editId);
      } else {
          return await supabase.from('vehicles').insert([payload]);
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.associate_id) {
        addToast('warning', 'Campos Obrigatórios', 'Placa e Proprietário são necessários.');
        return;
    }

    setIsSubmitting(true);
    try {
        const cleanAssociateId = formData.associate_id === '' ? null : formData.associate_id;

        // 1. Payload Completo com Defaults para evitar erros de NOT NULL
        const payload: any = { 
            plate: formData.plate ? formData.plate.toUpperCase().trim() : '',
            associate_id: cleanAssociateId,
            km: Number(formData.km) || 0,
            status: formData.status || 'Ativo',
            brand: formData.brand ? formData.brand.toUpperCase() : '',
            model: formData.model ? formData.model.toUpperCase() : '',
            color: formData.color ? formData.color.toUpperCase() : '',
            
            // Campos Opcionais com Default Seguro
            renavam: formData.renavam ? formData.renavam.trim() : null, 
            chassi: formData.chassi ? formData.chassi.trim().toUpperCase() : null,
            type: formData.type || 'Automóvel', // Default seguro
            fuel: formData.fuel || 'Flex',      // Default seguro
            version: formData.version || '',
            uf: formData.uf || '',
            city: formData.city || '',
            notes: formData.notes || '',
            
            year_fab: formData.year_fab || '',
            year_model: formData.year_model || '',
            created_at: editId ? undefined : new Date().toISOString() 
        };
        
        // Limpeza de campos undefined
        Object.keys(payload).forEach(key => (payload as any)[key] === undefined && delete (payload as any)[key]);

        // Tentativa 1: Enviar Snake Case
        let { error } = await performSave(payload);

        // Lógica de Retry Inteligente
        if (error) {
             const isColumnError = error.message.includes('column') && error.message.includes('does not exist');
             const isNullError = error.message.includes('null value') && error.message.includes('constraint');
             
             if (isColumnError || isNullError) {
                console.warn('Tentando fallback para CamelCase/Legacy devido a erro:', error.message);
                
                const legacyPayload: any = {
                    ...payload,
                    associateId: cleanAssociateId, // Fallback comum
                    yearFab: payload.year_fab,
                    yearModel: payload.year_model
                };

                // HOTFIX: Se o erro for especificamente na coluna "year", adicionamos ela ao payload
                if (error.message.includes('column "year"')) {
                    const yearVal = payload.year_fab ? parseInt(payload.year_fab.replace(/\D/g, '')) : new Date().getFullYear();
                    legacyPayload['year'] = yearVal || 2024;
                }

                delete legacyPayload.associate_id;
                delete legacyPayload.year_fab;
                delete legacyPayload.year_model;

                const retryResult = await performSave(legacyPayload, true);
                
                if (!retryResult.error) {
                    error = null; // Sucesso no retry
                } else {
                    error = retryResult.error;
                }
             }
        }

        if (error) throw error;
        
        await loadData();
        setIsModalOpen(false);
        addToast('success', 'Sucesso', 'Veículo salvo corretamente.');
    } catch (err: any) {
        console.error(err);
        if (err.message?.includes('violates unique constraint')) {
            addToast('error', 'Duplicidade', 'Esta placa já está cadastrada.');
        } else if (err.message?.includes('null value')) {
            addToast('error', 'Erro de Dados', 'Um campo obrigatório não foi preenchido corretamente.');
        } else {
            addToast('error', 'Erro ao Salvar', err.message);
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    (v.plate && v.plate.includes(searchTerm.toUpperCase())) || 
    (v.model && v.model.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-black text-slate-800">Gestão de Veículos</h2>
            <p className="text-sm text-slate-500">Cadastro simplificado com busca automática.</p>
        </div>
        <div className="flex gap-2">
            <button onClick={loadData} className="bg-white text-slate-500 border border-slate-200 p-3 rounded-2xl hover:bg-slate-50 transition-all shadow-sm" title="Recarregar">
                <RefreshCw size={18} className={loading ? 'animate-spin' : ''}/>
            </button>
            <button onClick={() => handleOpenModal()} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl transition-all">
                <Plus size={18}/> Novo Veículo
            </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6">
            
            {/* SEARCH OR BULK ACTION BAR */}
            {selectedIds.length > 0 ? (
                <div className="flex-1 flex items-center gap-4 bg-slate-800 text-white p-2 pr-4 rounded-2xl animate-in fade-in slide-in-from-left-4 duration-300">
                    <button 
                        onClick={handleSelectAll}
                        className="flex items-center gap-2 px-4 py-2 hover:bg-white/10 rounded-xl transition-colors"
                    >
                        {selectedIds.length === filteredVehicles.length ? <CheckSquare size={20}/> : <Square size={20} className="opacity-50"/>}
                        <span className="text-sm font-bold">Selecionar Tudo</span>
                    </button>
                    <div className="h-6 w-px bg-white/20"></div>
                    <span className="text-sm font-medium">{selectedIds.length} selecionado(s)</span>
                    <div className="flex-1"></div>
                    <button 
                        onClick={() => promptDelete(selectedIds)}
                        className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg transition-all"
                    >
                        <Trash2 size={16}/> Excluir Seleção
                    </button>
                </div>
            ) : (
                <div className="relative w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                    <input className="w-full pl-12 p-3 bg-slate-50 rounded-xl outline-none font-bold text-slate-600" placeholder="Buscar placa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                </div>
            )}

            <div className="flex bg-slate-100 p-1 rounded-xl ml-4">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}><LayoutGrid size={18}/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white shadow' : ''}`}><List size={18}/></button>
            </div>
         </div>

         {loading ? <div className="text-center py-20 flex flex-col items-center justify-center text-slate-400">
            <Loader2 className="animate-spin mb-4 text-blue-600" size={32}/>
            <p className="text-xs font-bold uppercase tracking-widest">Carregando Veículos...</p>
         </div> : (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {filteredVehicles.length === 0 && (
                    <div className="col-span-full py-10 text-center text-slate-400 font-medium bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                        <Car size={32} className="mx-auto mb-2 opacity-50"/>
                        Nenhum veículo encontrado.
                    </div>
                )}
                {filteredVehicles.map(v => (
                    <div 
                        key={v.id} 
                        className={`p-5 border rounded-3xl transition-all relative group ${
                            selectedIds.includes(v.id) 
                            ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-200' 
                            : 'bg-slate-50/50 border-slate-100 hover:border-blue-200'
                        }`}
                    >
                        {/* Checkbox Selection */}
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleSelection(v.id); }}
                            className={`absolute top-4 left-4 p-1 rounded-lg transition-all z-10 ${
                                selectedIds.includes(v.id) 
                                ? 'text-blue-600 opacity-100' 
                                : 'text-slate-300 opacity-0 group-hover:opacity-100 hover:text-slate-500'
                            }`}
                        >
                            {selectedIds.includes(v.id) ? <CheckSquare size={20} fill="currentColor" className="text-blue-100"/> : <Square size={20}/>}
                        </button>

                        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                            <button onClick={() => handleOpenModal(v)} className="p-2 bg-white text-blue-600 hover:text-blue-800 rounded-lg shadow-sm border border-slate-100 hover:bg-blue-50 transition-colors">
                                <Edit size={16}/>
                            </button>
                            <button onClick={() => promptDelete([v.id])} className="p-2 bg-white text-slate-400 hover:text-red-600 rounded-lg shadow-sm border border-slate-100 hover:bg-red-50 transition-colors">
                                <Trash2 size={16}/>
                            </button>
                        </div>

                        <div className="flex justify-between items-start mb-4 pl-8"> {/* pl-8 para dar espaço ao checkbox */}
                            <div className="bg-slate-800 text-white px-3 py-1 rounded-lg font-black tracking-widest text-sm">{v.plate}</div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${v.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{v.status}</span>
                        </div>
                        <h4 className="font-black text-slate-800 uppercase text-sm truncate">{v.model || 'A DEFINIR'}</h4>
                        <p className="text-xs text-slate-500 font-bold uppercase mb-4">{v.brand} • {v.year_model || v.year_fab || '----'}</p>
                        
                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600 flex items-center gap-1"><User size={12}/> {associates.find(a => a.id === v.associate_id)?.name || 'N/A'}</span>
                            <span className="font-mono text-slate-400">{v.km} km</span>
                        </div>
                    </div>
                ))}
            </div>
         )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white sticky top-0 z-10">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Car className="text-blue-600"/> {editId ? 'Editar Veículo' : 'Cadastro de Veículo'}</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-slate-600"/></button>
                </div>
                <form onSubmit={handleSave} className="p-8 space-y-8">
                    {!editId && (
                        <div className="flex bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
                            <button type="button" onClick={() => setInputMode('auto')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${inputMode === 'auto' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                                <CloudLightning size={16}/> Busca Automática (API)
                            </button>
                            <button type="button" onClick={() => setInputMode('manual')} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all flex items-center justify-center gap-2 ${inputMode === 'manual' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>
                                <Keyboard size={16}/> Cadastro Manual
                            </button>
                        </div>
                    )}
                    {lookupError && inputMode === 'auto' && (
                        <div className="p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-red-600 animate-in fade-in slide-in-from-top-2">
                            <AlertCircle className="shrink-0" size={20} />
                            <div className="flex-1"><p className="text-sm font-medium">{lookupError}</p></div>
                        </div>
                    )}
                    
                    {/* SECTION 1: Identificação Básica */}
                    <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">1. Identificação Básica</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Placa *</label>
                                <input className="w-full p-4 bg-slate-50 border rounded-2xl font-black text-xl uppercase outline-none tracking-widest transition-all"
                                    placeholder="ABC1D23" maxLength={7} value={formData.plate}
                                    onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                                    onBlur={() => inputMode === 'auto' && handlePlateLookup()} />
                                <div className="absolute right-4 top-9 text-blue-600">
                                    {isSearchingPlate ? <Loader2 className="animate-spin"/> : (inputMode === 'auto' && <CloudLightning size={20}/>)}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Proprietário *</label>
                                <select className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"
                                    value={formData.associate_id || ''} onChange={e => setFormData({...formData, associate_id: e.target.value})}>
                                    <option value="">Selecione...</option>
                                    {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>

                            {/* RENAVAM E CHASSI OCULTOS e com default */}

                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">KM Atual</label>
                                <input type="number" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none" 
                                    value={formData.km} onChange={e => setFormData({...formData, km: Number(e.target.value)})} />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Status</label>
                                <select className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none"
                                    value={formData.status} onChange={e => setFormData({...formData, status: e.target.value as any})}>
                                    <option>Ativo</option>
                                    <option>Inativo</option>
                                    <option>Manutenção</option>
                                </select>
                            </div>
                        </div>
                    </section>

                    {/* SECTION 2: Características do Veículo */}
                    <section className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                           <Car size={14}/> 2. Características do Veículo
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Marca</label>
                              <input className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none uppercase" 
                                    value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value.toUpperCase()})} placeholder="Ex: TOYOTA" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Modelo</label>
                              <input className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none uppercase" 
                                    value={formData.model} onChange={e => setFormData({...formData, model: e.target.value.toUpperCase()})} placeholder="Ex: COROLLA XEI" />
                           </div>
                           <div>
                              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Palette size={10}/> Cor</label>
                              <input className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none uppercase" 
                                    value={formData.color} onChange={e => setFormData({...formData, color: e.target.value.toUpperCase()})} placeholder="Ex: PRATA" />
                           </div>
                           <div className="flex gap-2">
                               <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Ano Fab.</label>
                                  <input type="number" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none text-center" 
                                        value={formData.year_fab} onChange={e => setFormData({...formData, year_fab: e.target.value})} placeholder="2023" />
                               </div>
                               <div className="flex-1">
                                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1 flex items-center gap-1"><Calendar size={10}/> Ano Mod.</label>
                                  <input type="number" className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none text-center" 
                                        value={formData.year_model} onChange={e => setFormData({...formData, year_model: e.target.value})} placeholder="2024" />
                               </div>
                           </div>
                        </div>
                    </section>
                    
                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2 hover:bg-blue-700 transition-all">
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Save size={18}/> Salvar Veículo</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => !isDeleting && setShowDeleteModal(false)}></div>
            <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl p-8 text-center animate-in zoom-in duration-200">
                <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Trash2 size={40} />
                </div>
                <h3 className="text-xl font-black text-slate-800 mb-2">Confirmar Exclusão?</h3>
                <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
                    Você está prestes a remover <span className="font-bold text-slate-800">{itemsToDelete.length}</span> veículo(s).
                    <br/><span className="text-xs text-red-400">Esta ação não pode ser desfeita.</span>
                </p>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        onClick={() => setShowDeleteModal(false)} 
                        disabled={isDeleting}
                        className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] hover:bg-slate-200 transition-all disabled:opacity-50"
                    >
                        Cancelar
                    </button>
                    <button 
                        onClick={executeDelete} 
                        disabled={isDeleting}
                        className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] hover:bg-red-600 transition-all shadow-lg shadow-red-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isDeleting ? <Loader2 className="animate-spin" size={14}/> : 'Sim, Excluir'}
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
