
import React, { useState } from 'react';
import { Plus, Search, Package, Settings, Trash2, Edit3, Tag, Layers } from 'lucide-react';
import { CatalogItem } from '../types';

const Catalog: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'Peça' | 'Serviço'>('Peça');
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
          <p className="text-sm text-slate-500 font-medium">Gerencie peças e serviços padronizados para cotações.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
          <Plus size={20} /> Novo Item
        </button>
      </div>

      {/* Tabs & Search */}
      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button 
            onClick={() => setActiveTab('Peça')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Peça' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Peças
          </button>
          <button 
            onClick={() => setActiveTab('Serviço')}
            className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'Serviço' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Serviços
          </button>
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder={`Buscar em ${activeTab === 'Peça' ? 'Peças' : 'Serviços'}...`}
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <div key={item.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${item.type === 'Peça' ? 'bg-blue-50 text-blue-600' : 'bg-indigo-50 text-indigo-600'}`}>
                {item.type === 'Peça' ? <Package size={24} /> : <Settings size={24} />}
              </div>
              <div className="flex gap-1">
                <button className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Edit3 size={16}/></button>
                <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={16}/></button>
              </div>
            </div>
            <h3 className="font-bold text-slate-800 text-lg">{item.name}</h3>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">{item.code} • {item.unit}</p>
            
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                <Tag size={12} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">{item.category}</span>
              </div>
              <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 border border-slate-100 rounded-lg">
                <Layers size={12} className="text-slate-400" />
                <span className="text-xs font-bold text-slate-600">{item.type}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Catalog;
