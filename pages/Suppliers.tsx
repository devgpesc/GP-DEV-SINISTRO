
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Star, MessageCircle, MapPin, MoreVertical, 
  ShieldCheck, Phone, X, LayoutGrid, List, CheckCircle, Mail, AlertCircle,
  ExternalLink, Edit, Trash2, Shield
} from 'lucide-react';
import { Supplier } from '../types';
import { mockStorage, isSupabaseConfigured, supabase } from '../services/supabaseClient';

const Suppliers: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    segment: 'Peças' as any,
    whatsapp: '',
    email: '',
    city: ''
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    try {
      if (isSupabaseConfigured) {
        const { data, error } = await supabase.from('suppliers').select('*').order('name');
        if (!error && data) {
          setSuppliers(data);
          setLoading(false);
          return;
        }
      }
      
      const saved = mockStorage.get('suppliers') || [
        { id: '1', name: 'Peças Express Matriz', cnpj: '12.345.678/0001-01', rating: 4.8, segment: 'Peças', whatsapp: '5511999999999', status: 'Ativo', city: 'São Paulo', createdAt: new Date().toISOString() },
        { id: '2', name: 'Oficina Silva e Filhos', cnpj: '98.765.432/0001-10', rating: 4.5, segment: 'Ambos', whatsapp: '5511888888888', status: 'Ativo', city: 'Curitiba', createdAt: new Date().toISOString() },
      ];
      setSuppliers(saved);
    } catch (e) {
      console.error("Falha ao carregar fornecedores:", e);
    } finally {
      setLoading(false);
    }
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSupplier: Supplier = {
      id: Math.random().toString(36).substr(2, 9),
      ...formData,
      rating: 5.0,
      status: 'Ativo',
      createdAt: new Date().toISOString()
    };

    if (isSupabaseConfigured) {
      try {
        await supabase.from('suppliers').insert([newSupplier]);
      } catch (err) {
        console.warn("Erro ao salvar no Supabase, usando local storage.");
      }
    }

    const updated = [newSupplier, ...suppliers];
    setSuppliers(updated);
    mockStorage.set('suppliers', updated);
    setIsModalOpen(false);
    setFormData({ name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', city: '' });
  };

  const filtered = suppliers.filter(s => 
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    s.cnpj.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou CNPJ..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 rounded-xl outline-none border border-slate-100 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={18}/></button>
          <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><List size={18}/></button>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
           {[1,2,3].map(i => <div key={i} className="h-48 bg-slate-100 rounded-3xl"></div>)}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all group relative overflow-hidden">
              <div className="flex justify-between mb-4 relative z-10">
                <div className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center font-black text-xl text-blue-600">{s.name.charAt(0)}</div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded-lg text-xs">
                    <Star size={14} fill="currentColor"/> {s.rating.toFixed(1)}
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded ${s.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                </div>
              </div>
              
              <h3 className="font-bold text-slate-800 line-clamp-1">{s.name}</h3>
              <p className="text-[10px] font-black text-slate-400 uppercase mb-4">{s.cnpj}</p>
              
              <div className="space-y-2 mb-6 text-xs text-slate-500">
                <p className="flex items-center gap-2 font-medium"><MapPin size={14} className="text-blue-500"/> {s.city}</p>
                <p className="flex items-center gap-2 font-medium"><Shield size={14} className="text-indigo-500"/> Especialista em {s.segment}</p>
                {s.email && <p className="flex items-center gap-2 font-medium"><Mail size={14} className="text-slate-400"/> {s.email}</p>}
              </div>
              
              <div className="flex gap-2 relative z-10">
                 <a 
                   href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} 
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-lg shadow-green-500/10"
                 >
                   <MessageCircle size={14}/> WhatsApp
                 </a>
                 <div className="group/actions relative">
                   <button className="w-10 h-full bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"><MoreVertical size={18}/></button>
                   <div className="absolute bottom-full right-0 mb-2 w-32 bg-white border border-slate-100 rounded-xl shadow-xl hidden group-hover/actions:block overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                     <button className="w-full px-4 py-2 text-left text-xs font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit size={14}/> Editar</button>
                     <button className="w-full px-4 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 flex items-center gap-2"><Trash2 size={14}/> Bloquear</button>
                   </div>
                 </div>
              </div>
              
              <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                 <ExternalLink size={14} className="text-slate-300" />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border border-dashed border-slate-200">
               <ShieldCheck size={48} className="mx-auto text-slate-200 mb-4" />
               <p className="text-slate-400 font-bold uppercase text-xs tracking-widest">Nenhum parceiro homologado para esta busca.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Segmento</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Rating</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(s => (
                <tr key={s.id} className="hover:bg-slate-50/50 group transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{s.cnpj}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{s.city}</td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-600">{s.segment}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded ${s.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="inline-flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded-lg text-xs">
                       <Star size={12} fill="currentColor"/> {s.rating.toFixed(1)}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in fade-in duration-200">
            <div className="p-6 border-b border-slate-100 flex justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                 <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20"><Plus size={24}/></div>
                 <div>
                    <h3 className="text-xl font-bold text-slate-800">Homologar Parceiro</h3>
                    <p className="text-[11px] text-slate-500 font-medium">Cadastre fornecedores de confiança para o seu ecossistema.</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"><X size={20}/></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Razão Social / Nome Fantasia *</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ / CPF *</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.cnpj} onChange={e => setFormData({...formData, cnpj: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Segmento</label>
                  <select className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value as any})}>
                    <option value="Peças">Peças</option>
                    <option value="Serviços">Serviços</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">WhatsApp (DDDNÚMERO)</label>
                  <input className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value.replace(/\D/g, '')})} placeholder="Ex: 11999999999" />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Cidade *</label>
                  <input required className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value})} />
                </div>
                <div className="col-span-2">
                   <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail para Cotações (Opcional)</label>
                   <input type="email" className="w-full p-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-2 text-slate-400 font-bold hover:text-slate-600 transition-colors">Cancelar</button>
                <button type="submit" className="px-10 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl shadow-blue-500/20 uppercase text-xs tracking-widest hover:bg-blue-700 transition-all">Finalizar Cadastro</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
