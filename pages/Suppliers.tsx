
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, Search, Star, MessageCircle, MapPin, X, 
  LayoutGrid, List, Edit, Trash2, Shield, Loader2, 
  TrendingUp, Clock, Globe, User, Mail, Phone
} from 'lucide-react';
import { Supplier } from '../types';
import { mockStorage, isSupabaseConfigured, supabase } from '../services/supabaseClient';
import { lookupService } from '../services/lookupService';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const Suppliers: React.FC = () => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [supplierToEdit, setSupplierToEdit] = useState<Supplier | null>(null);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado específico para o Loading da busca de CNPJ
  const [isLookingUp, setIsLookingUp] = useState(false);
  const [lookupMessage, setLookupMessage] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    name: '', cnpj: '', segment: 'Peças' as any, whatsapp: '', email: '', city: '', status: 'Ativo' as any, rating: 5, contactName: ''
  });

  useEffect(() => {
    loadSuppliers();
  }, []);

  async function loadSuppliers() {
    setLoading(true);
    const saved = mockStorage.get('suppliers') || [
      { id: '1', name: 'Elisa Maria', cnpj: '70435786121', rating: 5.0, segment: 'Ambos', whatsapp: '5511999999999', status: 'Ativo', city: 'APARECIDA DE GOIANIA', createdAt: new Date().toISOString(), contactName: 'Elisa' },
      { id: '2', name: 'Oficina Silva e Filhos', cnpj: '98.765.432/0001-10', rating: 4.5, segment: 'Ambos', whatsapp: '5511888888888', status: 'Ativo', city: 'Curitiba', createdAt: new Date().toISOString(), contactName: 'Roberto Silva' },
    ];
    setSuppliers(saved);
    setLoading(false);
  }

  const handleEdit = (s: Supplier) => {
    setSupplierToEdit(s);
    setFormData({ 
      name: s.name,
      cnpj: s.cnpj,
      segment: s.segment,
      whatsapp: s.whatsapp,
      email: s.email || '',
      city: s.city,
      status: s.status,
      rating: s.rating,
      contactName: s.contactName || ''
    });
    setIsModalOpen(true);
  };

  const handleCNPJLookup = async () => {
    const cleanCnpj = formData.cnpj.replace(/\D/g, '');
    if (cleanCnpj.length < 14) return;
    
    setIsLookingUp(true);
    setLookupMessage('Buscando na Receita Federal...');
    
    try {
      const data = await lookupService.fetchCNPJ(cleanCnpj);
      if (data) {
        setFormData(prev => ({
          ...prev,
          name: data.name || data.fantasy || prev.name,
          city: data.city || prev.city,
          email: data.email || prev.email,
          whatsapp: data.phone || prev.whatsapp
        }));
        setLookupMessage('Dados encontrados!');
        setTimeout(() => setLookupMessage(null), 3000);
      } else {
        setLookupMessage('CNPJ não encontrado na base pública.');
      }
    } catch (e) {
        setLookupMessage('Erro ao conectar com API.');
    } finally { 
      setIsLookingUp(false); 
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSupplier = {
      id: supplierToEdit ? supplierToEdit.id : Math.random().toString(36).substr(2, 9),
      ...formData,
      createdAt: supplierToEdit ? supplierToEdit.createdAt : new Date().toISOString()
    };

    let updated;
    if (supplierToEdit) {
      updated = suppliers.map(s => s.id === supplierToEdit.id ? updatedSupplier : s);
    } else {
      updated = [updatedSupplier, ...suppliers];
    }

    setSuppliers(updated);
    mockStorage.set('suppliers', updated);
    setIsModalOpen(false);
    setSupplierToEdit(null);
    setLookupMessage(null);
    setFormData({name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', city: '', status: 'Ativo', rating: 5, contactName: ''});
  };

  const filtered = useMemo(() => {
    return suppliers.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || s.cnpj.includes(searchTerm));
  }, [suppliers, searchTerm]);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input type="text" placeholder="Buscar por nome ou CNPJ..." className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
        </div>
        <button onClick={() => { setSupplierToEdit(null); setFormData({name: '', cnpj: '', segment: 'Peças', whatsapp: '', email: '', city: '', status: 'Ativo', rating: 5, contactName: ''}); setIsModalOpen(true); }} className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-500/20 whitespace-nowrap">
          <Plus size={18} /> Novo Parceiro
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Fornecedor</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cidade</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filtered.map(s => (
              <tr key={s.id} className="hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => setSelectedSupplier(s)}>
                <td className="px-8 py-5">
                  <p className="font-bold text-slate-800">{s.name}</p>
                  <p className="text-[10px] text-slate-400 font-bold">{s.cnpj}</p>
                  {s.contactName && <p className="text-[10px] text-blue-600 font-bold mt-0.5 flex items-center gap-1"><User size={10}/> {s.contactName}</p>}
                </td>
                <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{s.city}</td>
                <td className="px-8 py-5">
                  <span className={`text-[9px] font-black uppercase px-2 py-1 rounded border ${s.status === 'Ativo' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-red-100 text-red-700 border-red-200'}`}>{s.status}</span>
                </td>
                <td className="px-8 py-5 text-right flex justify-end gap-2">
                   <button onClick={(e) => { e.stopPropagation(); handleEdit(s); }} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit size={18}/></button>
                   <button className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-50 flex justify-between">
              <div className="flex items-center gap-4">
                 <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-600/30 w-14 h-14 flex items-center justify-center"><Plus size={32}/></div>
                 <div>
                    <h3 className="text-2xl font-black text-slate-800 tracking-tight">{supplierToEdit ? 'Editar Parceiro' : 'Homologar Parceiro'}</h3>
                    <p className="text-xs text-slate-400 font-medium mt-1">Atualize os dados cadastrais do fornecedor.</p>
                 </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-1 text-slate-300 hover:text-slate-500"><X size={28}/></button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-x-8 gap-y-6">
                <div className="col-span-2">
                  <label className="flex justify-between items-end text-[10px] font-black uppercase text-slate-400 mb-2">
                    <span>CNPJ / CPF *</span>
                    {lookupMessage && <span className={`text-${lookupMessage.includes('Erro') || lookupMessage.includes('não') ? 'red' : 'green'}-500 flex items-center gap-1`}>{isLookingUp && <Loader2 className="animate-spin" size={10}/>} {lookupMessage}</span>}
                  </label>
                  <div className="relative">
                    <Shield className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                        required 
                        className={`w-full pl-12 pr-12 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/10 transition-all ${isLookingUp ? 'opacity-70' : ''}`}
                        value={formData.cnpj} 
                        onChange={e => setFormData({...formData, cnpj: e.target.value})} 
                        onBlur={handleCNPJLookup}
                        placeholder="00.000.000/0001-00"
                    />
                    {isLookingUp ? (
                       <div className="absolute right-4 top-1/2 -translate-y-1/2">
                          <Loader2 className="animate-spin text-blue-600" size={18} />
                       </div>
                    ) : (
                       <button type="button" onClick={handleCNPJLookup} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Buscar Dados">
                          <Globe size={18} />
                       </button>
                    )}
                  </div>
                </div>
                
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Razão Social *</label>
                  <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Nome do Responsável</label>
                  <div className="relative">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input className="w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20" value={formData.contactName} onChange={e => setFormData({...formData, contactName: e.target.value})} placeholder="Nome do contato principal" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">E-mail do Responsável</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input type="email" className="w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} placeholder="email@exemplo.com" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Telefone do Responsável</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input className="w-full pl-12 pr-4 py-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20" value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="(00) 00000-0000" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Cidade de Operação *</label>
                  <input required className="w-full p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20" value={formData.city} onChange={e => setFormData({...formData, city: e.target.value.toUpperCase()})} />
                </div>
                
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Avaliação (1-5)</label>
                  <div className="flex items-center gap-2 p-4 bg-[#F8FAFC] border border-slate-100 rounded-2xl">
                    <Star className="text-amber-500" fill="currentColor" size={20}/>
                    <input type="number" step="0.5" min="1" max="5" className="bg-transparent font-black w-full outline-none" value={formData.rating} onChange={e => setFormData({...formData, rating: parseFloat(e.target.value)})} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-6 pt-6 border-t border-slate-50 items-center">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-black uppercase text-[12px] tracking-widest hover:text-slate-600 transition-colors">CANCELAR</button>
                <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-full font-black shadow-xl shadow-blue-600/30 uppercase text-xs tracking-widest hover:bg-blue-700 transition-all">FINALIZAR CADASTRO</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Suppliers;
