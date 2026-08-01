
import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Settings, Trash2, Edit3, Tag, LayoutGrid, List, X, Loader2 } from 'lucide-react';
import { CatalogItem } from '../types';
import { supabase } from '../services/supabaseClient';
import { useToast } from '../context/ToastContext';
import ActionModal from '../components/ActionModal';

const Catalog: React.FC = () => {
  const { addToast } = useToast();
  const [activeTab, setActiveTab] = useState<'Peça' | 'Serviço'>('Peça');
  const [viewMode] = useState<'grid' | 'list'>('list');
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para CRUD
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CatalogItem | null>(null);
  const [itemToDelete, setItemToDelete] = useState<CatalogItem | null>(null);
  
  // Form State
  const [formData, setFormData] = useState<Partial<CatalogItem>>({
    code: '',
    name: '',
    category: '',
    type: 'Peça',
    unit: 'UN',
    description: ''
  });

  useEffect(() => {
    loadItems();
  }, []);

  const loadItems = async () => {
    setLoading(true);
    try {
        const { data, error } = await supabase.from('catalog_items').select('*');
        if (error) {
            // Tabela pode não existir ainda
            if (error.code === '42P01') {
                console.warn('Tabela catalog_items não existe. Por favor rode a migration.');
                setItems([]);
            } else {
                throw error;
            }
        } else {
            setItems(data || []);
        }
    } catch (e) {
        console.error('Erro ao carregar catálogo', e);
    } finally {
        setLoading(false);
    }
  };

  const handleOpenModal = (item?: CatalogItem) => {
    if (item) {
      setItemToEdit(item);
      setFormData(item);
    } else {
      setItemToEdit(null);
      const nextId = items.length + 1;
      setFormData({
        code: `${activeTab === 'Peça' ? 'PC' : 'SV'}-${String(nextId).padStart(3, '0')}`,
        name: '',
        category: '',
        type: activeTab,
        unit: activeTab === 'Peça' ? 'UN' : 'HL',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.code) {
        addToast('warning', 'Campos Obrigatórios', 'Preencha nome e código.');
        return;
    }
    
    setIsSaving(true);
    try {
        const payload = {
            code: formData.code,
            name: formData.name,
            category: formData.category,
            type: formData.type,
            unit: formData.unit,
            description: formData.description
        };

        if (itemToEdit) {
            const { error } = await supabase.from('catalog_items').update(payload).eq('id', itemToEdit.id);
            if (error) throw error;
            addToast('success', 'Item Atualizado', 'Alterações salvas no catálogo.');
        } else {
            const { error } = await supabase.from('catalog_items').insert([payload]);
            if (error) throw error;
            addToast('success', 'Item Criado', 'Novo item adicionado ao catálogo.');
        }
        
        // Recarrega items após sucesso para garantir sincronia
        await loadItems();
        setIsModalOpen(false);
    } catch (error: any) {
        console.error('Erro ao salvar item', error);
        addToast('error', 'Erro ao Salvar', error.message || 'Falha ao salvar item. Verifique se a migration foi aplicada.');
    } finally {
        setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    const { error } = await supabase.from('catalog_items').delete().eq('id', itemToDelete.id);
    if (error) {
      addToast('error', 'Erro ao Excluir', error.message);
    } else {
      setItems(items.filter(i => i.id !== itemToDelete.id));
      addToast('success', 'Item Removido', 'O item foi excluído com sucesso.');
    }
    setItemToDelete(null);
  };

  const filteredItems = items.filter(i => 
    i.type === activeTab && 
    (i.name.toLowerCase().includes(searchTerm.toLowerCase()) || i.code.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Catálogo de Itens</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie peças e serviços padronizados.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="app-btn-primary flex items-center gap-2"
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="app-toolbar flex-col md:flex-row">
        <div className="app-segmented">
          <button onClick={() => setActiveTab('Peça')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Peças</button>
          <button onClick={() => setActiveTab('Serviço')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Serviços</button>
        </div>
        <div className="flex-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <input type="text" placeholder="Buscar no catálogo..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm transition-all focus:ring-2 focus:ring-blue-500/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
      </div>

      {loading ? (
          <div className="py-20 text-center"><Loader2 className="animate-spin mx-auto text-blue-600" size={32}/></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredItems.map(item => (
            <div 
                key={item.id} 
                onClick={() => handleOpenModal(item)}
                className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all shadow-sm group relative cursor-pointer"
            >
              <div className="flex justify-between mb-4">
                 <div className={`p-3 rounded-xl ${item.type === 'Peça' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {item.type === 'Peça' ? <Package size={24}/> : <Settings size={24}/>}
                 </div>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={18}/></button>
                    <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
                 </div>
              </div>
              <h3 className="font-bold text-slate-800">{item.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{item.code} • {item.unit}</p>
              <div className="mt-4 flex gap-2">
                 <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">{item.category}</span>
              </div>
            </div>
          ))}
          {filteredItems.length === 0 && (
             <div className="col-span-full py-16 text-center text-slate-400 font-medium">Nenhum item encontrado nesta categoria.</div>
          )}
        </div>
      ) : (
        <div className="app-table-wrap animate-in fade-in duration-300">
           <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Código</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Item</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</th>
                   <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredItems.map(item => (
                   <tr key={item.id} onClick={() => handleOpenModal(item)} className="hover:bg-slate-50/50 group cursor-pointer">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{item.code}</td>
                      <td className="px-6 py-4">
                         <p className="text-sm font-bold text-slate-800">{item.name}</p>
                         <p className="text-[10px] text-slate-400">Unidade: {item.unit}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-600">{item.category}</td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={(e) => { e.stopPropagation(); handleOpenModal(item); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={16}/></button>
                            <button onClick={(e) => { e.stopPropagation(); setItemToDelete(item); }} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[32px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
             <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <div className="flex items-center gap-3">
                   <div className="bg-blue-600 p-2 rounded-xl text-white shadow-lg shadow-blue-600/20">
                      {formData.type === 'Peça' ? <Package size={20}/> : <Settings size={20}/>}
                   </div>
                   <h3 className="text-xl font-black text-slate-800">{itemToEdit ? 'Editar Item' : 'Novo Item do Catálogo'}</h3>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             
             <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Nome do Item</label>
                      <input 
                        required 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: Parachoque Dianteiro"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Código Interno</label>
                      <input 
                        required 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" 
                        value={formData.code} 
                        onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Categoria</label>
                      <select 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={formData.category}
                        onChange={e => setFormData({...formData, category: e.target.value})}
                      >
                         <option value="">Selecione...</option>
                         <option value="Funilaria">Funilaria</option>
                         <option value="Mecânica">Mecânica</option>
                         <option value="Elétrica">Elétrica</option>
                         <option value="Iluminação">Iluminação</option>
                         <option value="Vidros">Vidros</option>
                         <option value="Suspensão">Suspensão</option>
                      </select>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Tipo</label>
                      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                         <button type="button" onClick={() => setFormData({...formData, type: 'Peça', unit: 'UN'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Peça</button>
                         <button type="button" onClick={() => setFormData({...formData, type: 'Serviço', unit: 'HL'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Serviço</button>
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Unidade</label>
                      <select 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={formData.unit}
                        onChange={e => setFormData({...formData, unit: e.target.value})}
                      >
                         <option value="UN">Unidade (UN)</option>
                         <option value="HL">Hora Linear (HL)</option>
                         <option value="KG">Quilograma (KG)</option>
                         <option value="LT">Litro (LT)</option>
                      </select>
                   </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-50">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600 tracking-widest">Cancelar</button>
                   <button type="submit" disabled={isSaving} className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                      {isSaving && <Loader2 className="animate-spin" size={14}/>} {itemToEdit ? 'Salvar Alterações' : 'Cadastrar Item'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}

      <ActionModal
        isOpen={!!itemToDelete}
        onClose={() => setItemToDelete(null)}
        onConfirm={confirmDelete}
        title="Remover item do catálogo?"
        description="Tem certeza que deseja remover este item do catálogo? Esta ação não pode ser desfeita."
        type="danger"
        confirmText="Sim, remover"
      />
    </div>
  );
};

export default Catalog;
