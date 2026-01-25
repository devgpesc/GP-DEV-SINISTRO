
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Star, MessageCircle, MapPin, MoreVertical, 
  ShieldCheck, Phone, X, LayoutGrid, List, CheckCircle, Mail, AlertCircle,
  ExternalLink, Edit, Trash2, Shield, Loader2, TrendingUp, BarChart3, Clock
} from 'lucide-react';
import { Supplier } from '../types';
import { mockStorage, isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Suppliers: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [isLookingUp, setIsLookingUp] = useState(false);
  
  const [filterSegment, setFilterSegment] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterCity, setFilterCity] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    cnpj: '',
    segment: 'Peças' as any,
    whatsapp: '',
    email: '',
    city: '',
    status: 'Ativo' as any,
    blockedReason: '',
    rating: 5
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

  const handleCNPJLookup = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length !== 14) return;
    
    setIsLookingUp(true);
    try {
      // Consulta real via BrasilAPI para automatizar o preenchimento
      const response = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${cleanCnpj}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          name: data.razao_social || data.nome_fantasia || prev.name,
          city: data.municipio || prev.city,
          email: data.email || prev.email,
        }));
      }
    } catch (error) {
      console.error("Erro no lookup de CNPJ:", error);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if ((formData.status === 'Bloqueado' || formData.status === 'Inativo') && !formData.blockedReason) {
      alert("Por favor, informe o motivo da alteração de status.");
      return;
    }

    const newSupplier: Supplier = {
      id: selectedSupplier?.id || Math.random().toString(36).substr(2, 9),
      ...formData,
      createdAt: selectedSupplier?.createdAt || new Date().toISOString()
    };

    let updated;
    if (selectedSupplier) {
      updated = suppliers.map(s => s.id === selectedSupplier.id ? newSupplier : s);
    } else {
      updated = [newSupplier, ...suppliers];
    }

    setSuppliers(updated);
    mockStorage.set('suppliers', updated);
    setIsModalOpen(false);
    setSelectedSupplier(null);
    setFormData({ name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', city: '', status: 'Ativo', blockedReason: '', rating: 5 });
  };

  const filtered = useMemo(() => {
    return suppliers.filter(s => {
      const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.cnpj.includes(searchTerm);
      const matchesSegment = filterSegment === 'Todos' || s.segment === filterSegment;
      const matchesStatus = filterStatus === 'Todos' || s.status === filterStatus;
      const matchesCity = !filterCity || s.city.toLowerCase().includes(filterCity.toLowerCase());
      return matchesSearch && matchesSegment && matchesStatus && matchesCity;
    });
  }, [suppliers, searchTerm, filterSegment, filterStatus, filterCity]);

  const priceHistoryData = [
    { name: 'Jan', price: 400 },
    { name: 'Fev', price: 420 },
    { name: 'Mar', price: 380 },
    { name: 'Abr', price: 450 },
    { name: 'Mai', price: 430 },
  ];

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CNPJ..."
              className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm focus:ring-2 focus:ring-blue-500/10"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex bg-slate-100 p-1 rounded-xl h-fit">
            <button onClick={() => setViewMode('grid')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={18}/></button>
            <button onClick={() => setViewMode('list')} className={`p-2.5 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}><List size={18}/></button>
          </div>
          <button 
            onClick={() => {
              setSelectedSupplier(null);
              setFormData({ name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', city: '', status: 'Ativo', blockedReason: '', rating: 5 });
              setIsModalOpen(true);
            }}
            className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 whitespace-nowrap"
          >
            <Plus size={18} /> Novo Parceiro
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-slate-50">
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Segmento</label>
            <select 
              value={filterSegment}
              onChange={(e) => setFilterSegment(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
            >
              <option>Todos</option>
              <option>Peças</option>
              <option>Serviços</option>
              <option>Ambos</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Status</label>
            <select 
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full p-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
            >
              <option>Todos</option>
              <option>Ativo</option>
              <option>Inativo</option>
              <option>Bloqueado</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Cidade</label>
            <div className="relative">
              <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input 
                type="text" 
                placeholder="Filtrar cidade..."
                value={filterCity}
                onChange={(e) => setFilterCity(e.target.value)}
                className="w-full pl-9 pr-4 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500/10"
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-blue-600" size={40} /></div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(s => (
            <div key={s.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm hover:border-blue-200 transition-all group relative overflow-hidden flex flex-col">
              <div className="flex justify-between mb-4 relative z-10">
                <div 
                  className="w-12 h-12 bg-blue-50 border border-blue-100 rounded-2xl flex items-center justify-center font-black text-xl text-blue-600 cursor-pointer"
                  onClick={() => setSelectedSupplier(s)}
                >
                  {s.name.charAt(0)}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-2 py-1 rounded-lg text-xs">
                    <Star size={14} fill="currentColor"/> {s.rating.toFixed(1)}
                  </div>
                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${
                    s.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200' : 
                    s.status === 'Bloqueado' ? 'bg-red-100 text-red-700 border-red-200' : 
                    'bg-slate-100 text-slate-500 border-slate-200'
                  }`}>{s.status}</span>
                </div>
              </div>
              
              <div className="cursor-pointer flex-1" onClick={() => setSelectedSupplier(s)}>
                <h3 className="font-bold text-slate-800 line-clamp-1">{s.name}</h3>
                <p className="text-[10px] font-black text-slate-400 uppercase mb-4">{s.cnpj}</p>
                
                <div className="space-y-2 mb-6 text-xs text-slate-500">
                  <p className="flex items-center gap-2 font-medium"><MapPin size={14} className="text-blue-500"/> {s.city}</p>
                  <p className="flex items-center gap-2 font-medium"><Shield size={14} className="text-indigo-500"/> {s.segment}</p>
                </div>
              </div>
              
              <div className="flex gap-2 relative z-10 pt-4 border-t border-slate-50">
                 <a 
                   href={`https://wa.me/${s.whatsapp.replace(/\D/g, '')}`} 
                   target="_blank"
                   rel="noopener noreferrer"
                   className="flex-1 bg-green-500 text-white py-2.5 rounded-xl text-xs font-bold text-center flex items-center justify-center gap-2 hover:bg-green-600 transition-colors shadow-lg shadow-green-500/10"
                 >
                   <MessageCircle size={14}/> WhatsApp
                 </a>
                 <button 
                  onClick={() => {
                    setSelectedSupplier(s);
                    setFormData({ ...s });
                    setIsModalOpen(true);
                  }}
                  className="w-10 h-11 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-200 transition-colors"
                 >
                   <Edit size={18}/>
                 </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
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
                <tr key={s.id} className="hover:bg-slate-50/50 group transition-colors cursor-pointer" onClick={() => setSelectedSupplier(s)}>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800">{s.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{s.cnpj}</p>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-slate-600">{s.city}</td>
                  <td className="px-6 py-4 text-xs font-bold text-blue-600">{s.segment}</td>
                  <td className="px-6 py-4">
                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${
                      s.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200' : 
                      s.status === 'Bloqueado' ? 'bg-red-100 text-red-700 border-red-200' : 
                      'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>{s.status}</span>
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

      {selectedSupplier && !isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setSelectedSupplier(null)}></div>
          <div className="relative bg-white w-full max-w-4xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300 overflow-hidden">
            <div className="p-10 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-6">
                 <div className="w-20 h-20 bg-blue-600 text-white rounded-[24px] flex items-center justify-center text-4xl font-black shadow-xl shadow-blue-500/20">{selectedSupplier.name.charAt(0)}</div>
                 <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter">{selectedSupplier.name}</h2>
                    <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">{selectedSupplier.cnpj} • {selectedSupplier.segment}</p>
                 </div>
              </div>
              <button onClick={() => setSelectedSupplier(null)} className="p-3 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"><X size={32}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 space-y-12">
               <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Avaliação Geral</p>
                    <div className="flex items-center gap-2">
                       <Star className="text-amber-400" fill="currentColor" size={24}/>
                       <span className="text-2xl font-black text-slate-800">{selectedSupplier.rating.toFixed(1)}</span>
                    </div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Status do Parceiro</p>
                    <span className={`px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border ${
                      selectedSupplier.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'
                    }`}>{selectedSupplier.status}</span>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl border border-slate-100">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Localização</p>
                    <p className="text-lg font-black text-slate-800 flex items-center gap-2"><MapPin className="text-blue-500" size={18}/> {selectedSupplier.city}</p>
                  </div>
               </div>

               <div className="space-y-6">
                  <div className="flex items-center justify-between">
                     <h3 className="text-lg font-black text-slate-800 flex items-center gap-3">
                        <TrendingUp className="text-blue-600" size={24}/> 
                        Tendência de Preços (Item: Parachoque Corolla)
                     </h3>
                     <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Clock size={14}/> Última Cotação: Hoje
                     </div>
                  </div>
                  <div className="bg-white border border-slate-100 rounded-[32px] p-8 h-80 shadow-sm">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={priceHistoryData}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                        <Tooltip contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                        <Line type="monotone" dataKey="price" stroke="#3b82f6" strokeWidth={4} dot={{ r: 6, fill: '#3b82f6', strokeWidth: 0 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in fade-in duration-200">
            <div className="p-8 border-b border-slate-50 flex justify-between">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-600/30 flex items-center justify-center w-14 h-14">
                   <Plus size={32}/>
                 </div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Homologar Parceiro</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Cadastro oficial de fornecedores do ecossistema.</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-300 hover:text-slate-500 transition-colors">
                <X size={28}/>
              </button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">CNPJ / CPF *</label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      required 
                      className="w-full pl-12 pr-12 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm" 
                      value={formData.cnpj} 
                      onChange={e => setFormData({...formData, cnpj: e.target.value.replace(/\D/g, '')})} 
                      onBlur={handleCNPJLookup}
                      placeholder="Somente números"
                    />
                    {isLookingUp && <Loader2 size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-blue-500 animate-spin" />}
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Razão Social / Nome Fantasia *</label>
                  <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Segmento de Atuação</label>
                  <select className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm appearance-none" value={formData.segment} onChange={e => setFormData({...formData, segment: e.target.value as any})}>
                    <option value="Peças">Peças</option>
                    <option value="Serviços">Serviços</option>
                    <option value="Ambos">Ambos</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Avaliação (Rating)</label>
                  <div className="flex items-center gap-2 p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl">
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5].map(star => (
                        <button 
                          key={star} 
                          type="button" 
                          onClick={() => setFormData({...formData, rating: star})}
                          className="transition-transform active:scale-90"
                        >
                          <Star size={20} fill={star <= formData.rating ? "#f59e0b" : "none"} className={star <= formData.rating ? "text-amber-500" : "text-slate-200"} />
                        </button>
                      ))}
                    </div>
                    <span className="ml-1 font-black text-slate-700 text-sm">{formData.rating}.0</span>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Status</label>
                  <select 
                    className={`w-full p-4 rounded-2xl font-black outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm border appearance-none ${
                      formData.status === 'Ativo' ? 'bg-green-50/50 text-green-700 border-green-100' : 'bg-red-50/50 text-red-700 border-red-100'
                    }`}
                    value={formData.status} 
                    onChange={e => setFormData({...formData, status: e.target.value as any})}
                  >
                    <option value="Ativo">Ativo</option>
                    <option value="Inativo">Inativo</option>
                    <option value="Bloqueado">Bloqueado</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Cidade de Operação *</label>
                  <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all text-sm" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} />
                </div>

                {(formData.status === 'Bloqueado' || formData.status === 'Inativo') && (
                  <div className="col-span-2 animate-in slide-in-from-top-4">
                    <label className="block text-[10px] font-black uppercase text-red-500 mb-2 tracking-widest">Motivo da Alteração de Status *</label>
                    <textarea 
                      required
                      className="w-full p-4 bg-red-50 border border-red-100 rounded-2xl font-medium outline-none h-24 text-sm text-red-900" 
                      placeholder="Descreva por que este parceiro está sendo inativado ou bloqueado..."
                      value={formData.blockedReason}
                      onChange={e => setFormData({...formData, blockedReason: e.target.value})}
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-6 pt-6 border-t border-slate-50 items-center">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-black uppercase text-[12px] tracking-widest hover:text-slate-600 transition-colors">CANCELAR</button>
                <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-full font-black shadow-xl shadow-blue-600/30 uppercase text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2">
                   {selectedSupplier ? 'SALVAR EDIÇÃO' : 'FINALIZAR CADASTRO'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
