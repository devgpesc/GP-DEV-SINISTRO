
import React, { useState } from 'react';
import { Plus, Search, Package, Settings, Trash2, Edit3, Tag, Layers, LayoutGrid, List } from 'lucide-react';
import { CatalogItem } from '../types';

const Catalog: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Peça' | 'Serviço'>('Peça');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [items, setItems] = useState<CatalogItem[]>([
    { id: '1', code: 'PC-001', name: 'Parachoque Dianteiro Corolla', category: 'Funilaria', type: 'Peça', unit: 'UN' },
    { id: '2', code: 'SV-001', name: 'Mão de Obra Funilaria Leve', category: 'Serviço', type: 'Serviço', unit: 'H' },
    { id: '3', code: 'PC-002', name: 'Farol LED Direito', category: 'Iluminação', type: 'Peça', unit: 'UN' },
  ]);

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
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 shadow-lg shadow-blue-500/20">
          <Plus size={20} /> Novo Item
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setActiveTab('Peça')} className={`px-6 py-2 rounded-lg text-sm font-bold ${activeTab === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Peças</button>
          <button onClick={() => setActiveTab('Serviço')} className={`px-6 py-2 rounded-lg text-sm font-bold ${activeTab === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}>Serviços</button>
        </div>
        <div className="flex-1 relative">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
           <input type="text" placeholder="Buscar no catálogo..." className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none text-sm" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
           <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
           <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-6 rounded-2xl border border-slate-200 hover:border-blue-200 transition-all shadow-sm">
              <div className="flex justify-between mb-4">
                 <div className={`p-3 rounded-xl ${item.type === 'Peça' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    {item.type === 'Peça' ? <Package size={24}/> : <Settings size={24}/>}
                 </div>
                 <button className="p-2 text-slate-300 hover:text-slate-600"><Edit3 size={18}/></button>
              </div>
              <h3 className="font-bold text-slate-800">{item.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mt-1">{item.code} • {item.unit}</p>
              <div className="mt-6 flex gap-2">
                 <span className="text-[10px] font-bold bg-slate-50 text-slate-500 px-2 py-1 rounded border border-slate-100">{item.category}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
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
                   <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4 text-xs font-bold text-slate-400">{item.code}</td>
                      <td className="px-6 py-4">
                         <p className="text-sm font-bold text-slate-800">{item.name}</p>
                         <p className="text-[10px] text-slate-400">Unidade: {item.unit}</p>
                      </td>
                      <td className="px-6 py-4 text-xs font-bold text-blue-600">{item.category}</td>
                      <td className="px-6 py-4 text-right">
                         <button className="p-2 text-slate-400 hover:text-blue-600"><Edit3 size={16}/></button>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}
    </div>
  );
};

export default Catalog;
