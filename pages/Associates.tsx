
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, UserCheck, Edit3, Trash2, X, Save, 
  Car, LayoutGrid, List, Phone, Mail, Shield, User, Loader2, AlertCircle, Globe
} from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { lookupService } from '../services/lookupService';
import ActionModal from '../components/ActionModal';
import { useToast } from '../context/ToastContext';

interface Associate {
  id: string;
  name: string;
  document: string; 
  type: 'PF' | 'PJ';
  responsible?: string;
  email?: string;
  phone?: string;
  createdAt: string;
}

const Associates: React.FC = () => {
  const { addToast } = useToast();
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [viewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  
  // States para Lookup
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  
  const [associateToEdit, setAssociateToEdit] = useState<Associate | null>(null);
  
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    type: 'PF' as 'PF' | 'PJ',
    responsible: '', 
    email: '',
    phone: '',
    linkedPlate: ''
  });

  useEffect(() => {
    loadAssociates();
  }, []);

  const loadAssociates = async () => {
    try {
        const { data, error } = await supabase.from('associates').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        setAssociates(data || []);
    } catch (error) {
        console.error('Erro ao carregar associados:', error);
    }
  };

  const handleOpenModal = (associate?: Associate) => {
    setLookupMessage(null);
    if (associate) {
      setAssociateToEdit(associate);
      setFormData({
        name: associate.name,
        document: associate.document,
        type: associate.type,
        responsible: associate.responsible || '',
        email: associate.email || '',
        phone: associate.phone || '',
        linkedPlate: ''
      });
    } else {
      setAssociateToEdit(null);
      setFormData({
        name: '',
        document: '',
        type: 'PF',
        responsible: '',
        email: '',
        phone: '',
        linkedPlate: ''
      });
    }
    setIsModalOpen(true);
  };

  const confirmDelete = async () => {
    if (deleteId) {
      try {
          const { error } = await supabase.from('associates').delete().eq('id', deleteId);
          if (error) throw error;
          
          setAssociates(prev => prev.filter(a => a.id !== deleteId));
          setDeleteId(null);
          addToast('success', 'Excluído', 'Associado removido com sucesso.');
      } catch (error: any) {
          addToast('error', 'Erro', 'Não foi possível excluir o associado.');
      }
    }
  };

  const handleDocumentLookup = async () => {
      // Limpeza básica
      const cleanDoc = formData.document.replace(/\D/g, '');
      
      // Lógica apenas para CNPJ (14 dígitos)
      if (formData.type === 'PJ' && cleanDoc.length === 14) {
          setIsLookingUp(true);
          setLookupMessage('Buscando dados do CNPJ...');
          
          try {
              const data = await lookupService.fetchCNPJ(cleanDoc);
              if (data) {
                  setFormData(prev => ({
                      ...prev,
                      name: data.name || data.fantasy || prev.name,
                      email: data.email || prev.email,
                      phone: data.phone || prev.phone,
                  }));
                  setLookupMessage('Dados encontrados!');
                  addToast('success', 'Encontrado', 'Dados da empresa preenchidos.');
              } else {
                  setLookupMessage('CNPJ não encontrado nas bases públicas.');
              }
          } catch (e) {
              setLookupMessage('Erro na consulta.');
          } finally {
              setIsLookingUp(false);
              setTimeout(() => setLookupMessage(null), 3000);
          }
      }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.document) {
        addToast('warning', 'Campos Obrigatórios', 'Preencha Nome e Documento.');
        return;
    }
    
    setIsSubmitting(true);
    
    try {
        const payload = {
            name: formData.name,
            document: formData.document,
            type: formData.type,
            responsible: formData.responsible,
            email: formData.email,
            phone: formData.phone,
        };

        let result: any;
        if (associateToEdit) {
            const { data, error } = await supabase.from('associates').update(payload).eq('id', associateToEdit.id).select().single();
            if (error) throw error;
            result = data;
            setAssociates(associates.map(a => a.id === result.id ? result : a));
            addToast('success', 'Atualizado', 'Dados do associado salvos.');
        } else {
            const { data, error } = await supabase.from('associates').insert([{
                ...payload,
                created_at: new Date().toISOString()
            }]).select().single();
            
            if (error) throw error;
            if (!data) throw new Error("Erro ao criar registro: Nenhum dado retornado.");
            
            result = data;
            setAssociates([result, ...associates]);
            addToast('success', 'Criado', 'Novo associado cadastrado.');
        }

        // --- LÓGICA DE VÍNCULO DE VEÍCULO SEGURO ---
        // Isolado em try/catch para garantir que o modal feche mesmo se o veículo falhar
        if (result && result.id && formData.linkedPlate && formData.linkedPlate.length >= 7) {
            try {
                const cleanPlate = formData.linkedPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
                
                // 1. Verifica se o veículo existe
                const { data: existing } = await supabase.from('vehicles').select('id, associate_id').eq('plate', cleanPlate).maybeSingle();

                if (existing) {
                    if (existing.associate_id && existing.associate_id !== result.id) {
                        throw new Error(`A placa ${cleanPlate} já está vinculada a outro associado.`);
                    }
                    // Atualiza veículo existente
                    const { error: linkError } = await supabase
                        .from('vehicles')
                        .update({ associate_id: result.id }) 
                        .eq('id', existing.id);
                    
                    if (linkError) throw linkError;
                    addToast('info', 'Veículo Vinculado', `Placa ${cleanPlate} associada ao cadastro.`);
                    
                } else {
                    // Cria novo veículo com PAYLOAD ROBUSTO
                    const currentYear = new Date().getFullYear().toString();
                    
                    const newVehiclePayload = {
                        plate: cleanPlate,
                        associate_id: result.id,
                        status: 'Ativo',
                        brand: '—',
                        model: cleanPlate,
                        color: 'BRANCA',
                        fuel: 'FLEX',
                        type: 'Automóvel',
                        year_fab: currentYear,
                        year_model: currentYear,
                        created_at: new Date().toISOString()
                    };

                    const { error: vError } = await supabase.from('vehicles').insert([newVehiclePayload]);
                    
                    if (vError) {
                        console.error('Erro detalhado ao criar veículo:', vError);
                        throw new Error(`Falha ao criar veículo ${cleanPlate}.`);
                    }
                    addToast('info', 'Veículo Criado', `Placa ${cleanPlate} cadastrada automaticamente.`);
                }
            } catch (vehicleErr: any) {
                console.error("Falha ao processar veículo:", vehicleErr);
                // Não lança o erro, apenas avisa, pois o associado já foi salvo
                addToast('warning', 'Atenção', 'Associado salvo, mas houve erro ao vincular o veículo: ' + vehicleErr.message);
            }
        }

        // Se chegou aqui, o associado foi salvo (e o veículo tentado). Fecha o modal.
        setIsModalOpen(false);

    } catch (error: any) {
        console.error("Erro no cadastro:", error);
        // Tratamento específico para erro de permissão RLS
        if (error.code === '42501' || error.message?.includes('violates row-level security')) {
             addToast('error', 'Permissão Negada', 'Verifique se você está logado corretamente.');
        } else {
             addToast('error', 'Erro ao Salvar', error.message || 'Falha na operação.');
        }
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredAssociates = associates.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.document.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Base de Associados</h2>
          <p className="text-sm text-slate-500 font-medium">Gestão de clientes e proprietários de veículos.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="app-btn-primary flex items-center gap-2"
        >
          <Plus size={18} /> Novo Associado
        </button>
      </div>

      <div className="app-toolbar flex-col md:flex-row">
        <div className="flex-1 relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
           <input 
             type="text" 
             placeholder="Buscar por nome, CPF ou CNPJ..." 
             className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all" 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)} 
           />
        </div>
      </div>

      {/* Grid e List Views */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredAssociates.map(associate => (
            <div 
                key={associate.id} 
                onClick={() => handleOpenModal(associate)}
                className="bg-white p-6 rounded-[32px] border border-slate-200 hover:border-blue-300 transition-all shadow-sm group relative cursor-pointer"
            >
              <div className="flex justify-between items-start mb-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${associate.type === 'PJ' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                    {associate.type === 'PJ' ? <Shield size={24}/> : <User size={24}/>}
                 </div>
                 <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${associate.type === 'PJ' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                    {associate.type}
                 </span>
              </div>
              <h3 className="font-black text-slate-800 text-lg mb-1 truncate" title={associate.name}>{associate.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">{associate.document}</p>
              {associate.responsible && (
                  <p className="text-xs text-indigo-600 font-bold mb-4 flex items-center gap-1"><User size={12}/> Resp: {associate.responsible}</p>
              )}
              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={(e) => { e.stopPropagation(); handleOpenModal(associate); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                 <button onClick={(e) => { e.stopPropagation(); setDeleteId(associate.id); }} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="app-table-wrap animate-in fade-in duration-300">
           <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome / Razão Social</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredAssociates.map(a => (
                   <tr key={a.id} onClick={() => handleOpenModal(a)} className="hover:bg-slate-50/50 group cursor-pointer">
                      <td className="px-8 py-5"><span className="font-bold text-slate-700">{a.name}</span></td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">{a.document}</td>
                      <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(a); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={18}/></button>
                            <button onClick={(e) => { e.stopPropagation(); setDeleteId(a.id); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200 max-h-[95vh] overflow-y-auto">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                <div className="flex items-center gap-4">
                   <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/30"><UserCheck size={24}/></div>
                   <div>
                      <h3 className="text-xl font-black text-slate-800">{associateToEdit ? 'Editar Associado' : 'Cadastro de Associado'}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Preencha os dados e vincule veículos.</p>
                   </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>

             <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Nome Completo / Razão Social *</label>
                      <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} placeholder="Ex: João da Silva" />
                   </div>
                   
                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Tipo de Pessoa</label>
                      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                         <button type="button" onClick={() => setFormData({...formData, type: 'PF'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Física (PF)</button>
                         <button type="button" onClick={() => setFormData({...formData, type: 'PJ'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PJ' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Jurídica (PJ)</button>
                      </div>
                   </div>

                   <div>
                      <label className="flex justify-between items-center text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">
                          <span>Documento (CPF/CNPJ) *</span>
                          {lookupMessage && <span className={`text-[9px] flex items-center gap-1 ${lookupMessage.includes('Encontrado') ? 'text-green-600' : 'text-amber-500'}`}>{isLookingUp && <Loader2 className="animate-spin" size={8}/>} {lookupMessage}</span>}
                      </label>
                      <div className="relative">
                          <input 
                            required 
                            className={`w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all ${isLookingUp ? 'opacity-70' : ''}`} 
                            value={formData.document} 
                            onChange={e => setFormData({...formData, document: e.target.value})}
                            onBlur={handleDocumentLookup} 
                            placeholder={formData.type === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'} 
                          />
                          {formData.type === 'PJ' && (
                              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                                  {isLookingUp ? <Loader2 className="animate-spin text-blue-600" size={18}/> : <Globe size={18}/>}
                              </div>
                          )}
                      </div>
                   </div>

                   <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Nome do Responsável</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" value={formData.responsible} onChange={e => setFormData({...formData, responsible: e.target.value})} placeholder="Nome do contato principal (se houver)" />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">E-mail</label>
                      <input type="email" className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Telefone / WhatsApp</label>
                      <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} placeholder="(00) 90000-0000" />
                   </div>

                   {!associateToEdit && (
                       <div className="col-span-2 mt-4 pt-6 border-t border-slate-100">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 mb-3 tracking-widest">
                             <Car size={16}/> Vincular Veículo (Opcional)
                          </label>
                          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                             <input className="w-full p-4 bg-white border border-blue-100 rounded-2xl font-black text-lg text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase tracking-[0.2em] text-center" value={formData.linkedPlate} onChange={e => setFormData({...formData, linkedPlate: e.target.value.toUpperCase()})} placeholder="ABC1D23" maxLength={7} />
                             <p className="text-[10px] text-center text-slate-400 mt-2 font-medium">O veículo será criado automaticamente com dados padrão se não existir.</p>
                          </div>
                       </div>
                   )}
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-50">
                   <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600 tracking-widest">Cancelar</button>
                   <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                      {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Salvar Associado</>}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      <ActionModal 
        isOpen={!!deleteId}
        onClose={() => setDeleteId(null)}
        onConfirm={confirmDelete}
        title="Excluir Associado?"
        description="Tem certeza que deseja excluir este associado? Os veículos vinculados ficarão sem proprietário."
        type="danger"
        confirmText="Sim, excluir"
      />
    </div>
  );
};

export default Associates;
