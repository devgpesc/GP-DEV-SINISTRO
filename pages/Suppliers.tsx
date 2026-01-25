
import React, { useState } from 'react';
import { Plus, Search, Star, MessageCircle, MapPin, MoreVertical, ShieldCheck, Phone } from 'lucide-react';
import { Supplier } from '../types';

const Suppliers: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const [suppliers, setSuppliers] = useState<Supplier[]>([
    { id: '1', name: 'Peças Express Matriz', cnpj: '12.345.678/0001-01', rating: 4.8, segment: 'Peças', whatsapp: '5511999999999', status: 'Ativo', city: 'São Paulo' },
    { id: '2', name: 'Oficina Silva e Filhos', cnpj: '98.765.432/0001-10', rating: 4.5, segment: 'Ambos', whatsapp: '5511888888888', status: 'Ativo', city: 'Curitiba' },
    { id: '3', name: 'Distribuidora Global', cnpj: '11.222.333/0001-44', rating: 3.2, segment: 'Peças', whatsapp: '5511777777777', status: 'Bloqueado', city: 'Belo Horizonte' },
  ]);

  const filteredSuppliers = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.cnpj.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Fornecedores Homologados</h2>
          <p className="text-sm text-slate-500 font-medium">Gerencie sua rede de parceiros e acompanhe o rating de entrega.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
          <Plus size={20} /> Novo Fornecedor
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CNPJ ou cidade..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredSuppliers.map((supplier) => (
          <div key={supplier.id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all flex flex-col h-full">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 font-black text-xl">
                  {supplier.name.charAt(0)}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 line-clamp-1">{supplier.name}</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">{supplier.cnpj}</p>
                </div>
              </div>
              <button className="p-2 text-slate-300 hover:text-slate-600"><MoreVertical size={20}/></button>
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="flex items-center gap-1 px-2 py-1 bg-amber-50 text-amber-600 rounded-lg text-xs font-black">
                <Star size={14} fill="currentColor" /> {supplier.rating}
              </div>
              <div className={`px-2 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest border ${
                supplier.status === 'Ativo' ? 'bg-green-50 text-green-600 border-green-100' : 'bg-red-50 text-red-600 border-red-100'
              }`}>
                {supplier.status}
              </div>
            </div>

            <div className="space-y-3 mb-6 flex-1">
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <MapPin size={14} /> {supplier.city}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <ShieldCheck size={14} /> Especialista em {supplier.segment}
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                <Phone size={14} /> {supplier.whatsapp}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-4 border-t border-slate-50">
              <button className="flex items-center justify-center gap-2 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-black transition-all">
                Histórico
              </button>
              <a 
                href={`https://wa.me/${supplier.whatsapp}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 py-2.5 bg-green-500 text-white rounded-xl text-xs font-bold hover:bg-green-600 transition-all"
              >
                <MessageCircle size={14} /> WhatsApp
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Suppliers;
