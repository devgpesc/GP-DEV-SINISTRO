import React, { useState, useEffect } from 'react';
import { Plus, Search, Package, Settings, Trash2, Edit3, Tag, Layers, LayoutGrid, List, X, CheckCircle, AlertCircle } from 'lucide-react';
import { CatalogItem } from '../types';
import { mockStorage } from '../services/supabaseClient';

const Catalog: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Peça' | 'Serviço'>('Peça');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  // States para CRUD
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState<CatalogItem | null>(null);
  
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

  const loadItems = () => {
    const saved = mockStorage.get('catalog_items') || [
      { id: '1', code: 'PC-001', name: 'Parachoque Dianteiro Corolla', category: 'Funilaria', type: 'Peça', unit: 'UN', description: 'Original Toyota' },
      { id: '2', code: 'SV-001', name: 'Mão de Obra Funilaria Leve', category: 'Serviço', type: 'Serviço', unit: 'H', description: 'Reparo simples' },
      { id: '3', code: 'PC-002', name: 'Farol LED Direito', category: 'Iluminação', type: 'Peça', unit: 'UN', description: 'Full LED' },
    ];
    setItems(saved);
  };

  const handleOpenModal = (item?: CatalogItem) => {
    if (item) {
      setItemToEdit(item);
      setFormData(item);
    } else {
      setItemToEdit(null);
      // Gerar código sequencial sugerido
      const nextId = items.length + 1;
      setFormData({
        code: `${activeTab === 'Peça' ? 'PC' : 'SV'}-${String(nextId).padStart(3, '0')}`,
        name: '',
        category: '',
        type: activeTab,
        unit: activeTab === 'Peça' ? 'UN' : 'H',
        description: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.code) return;

    const newItem: CatalogItem = {
      id: itemToEdit ? itemToEdit.id : Math.random().toString(36).substr(2, 9),
      code: formData.code || '',
      name: formData.name || '',
      category: formData.category || 'Geral',
      type: formData.type as 'Peça' | 'Serviço',
      unit: formData.unit || 'UN',
      description: formData.description
    };

    let updatedItems;
    if (itemToEdit) {
      updatedItems = items.map(i => i.id === itemToEdit.id ? newItem : i);
    } else {
      updatedItems = [...items, newItem];
    }

    setItems(updatedItems);
    mockStorage.set('catalog_items', updatedItems);
    setIsModalOpen(false);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Tem certeza que deseja remover este item do catálogo?')) {
      const updatedItems = items.filter(i => i.id !== id);
      setItems(updatedItems);
      mockStorage.set('catalog_items', updatedItems);
    }
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
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20 transition-all"
        >
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('Peça')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Peças</button>
          <button onClick={() => setActiveTab('Serviço')} className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Serviços</button>
        </div>
        <div className="flex-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <input type="text" placeholder="Buscar no catálogo..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm transition-all focus:ring-2 focus:ring-blue-500/20" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
           <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all shadow-sm group relative">
              <div className="flex justify-between mb-4">
                 <div className={`p-3 rounded-xl ${item.type === 'Peça' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {item.type === 'Peça' ? <Package size={24}/> : <Settings size={24}/>}
                 </div>
                 <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={18}/></button>
                    <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={18}/></button>
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
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
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
                   <tr key={item.id} className="hover:bg-slate-50/50 group">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{item.code}</td>
                      <td className="px-6 py-4">
                         <p className="text-sm font-bold text-slate-800">{item.name}</p>
                         <p className="text-[10px] text-slate-400">Unidade: {item.unit}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-600">{item.category}</td>
                      <td className="px-6 py-4 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={16}/></button>
                            <button onClick={() => handleDelete(item.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={16}/></button>
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
                         <button type="button" onClick={() => setFormData({...formData, type: 'Peça'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Peça</button>
                         <button type="button" onClick={() => setFormData({...formData, type: 'Serviço'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Serviço</button>
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
                         <option value="H">Hora (H)</option>
                         <option value="KG">Quilo (KG)</option>
                         <option value="L">Litro (L)</option>
                         <option value="M">Metro (M)</option>
                         <option value="JG">Jogo (JG)</option>
                      </select>
                   </div>
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-50">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600 tracking-widest">Cancelar</button>
                   <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all">
                      {itemToEdit ? 'Salvar Alterações' : 'Cadastrar Item'}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Catalog;