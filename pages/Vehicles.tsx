
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Car, Loader2, User, LayoutGrid, List, 
  Trash2, Edit, Save, CheckCircle2, AlertCircle, X, CloudLightning
} from 'lucide-react';
import { vehicleService } from '../services/vehicleService';
import { lookupService } from '../services/lookupService';
import { mockStorage } from '../services/supabaseClient';
import { Vehicle } from '../types';

interface Associate {
  id: string;
  name: string;
  document: string;
}

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal & Form States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  
  const [formData, setFormData] = useState<Partial<Vehicle>>({
    plate: '',
    associateId: '',
    km: 0,
    status: 'Ativo',
    notes: '',
    // Campos Auto
    brand: '', model: '', version: '', yearFab: '', yearModel: '', 
    color: '', fuel: '', type: '', chassi: '', renavam: '', uf: '', city: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Em produção, isso viria do Supabase
      const vs = mockStorage.get('vehicles') || [];
      const as = mockStorage.get('associates') || [];
      setVehicles(vs);
      setAssociates(as);
    } finally {
      setLoading(false);
    }
  };

  const handlePlateLookup = async () => {
    if (!formData.plate || formData.plate.length < 7) return;
    setIsSearchingPlate(true);
    
    try {
      const data = await lookupService.fetchPlate(formData.plate);
      if (data) {
        setFormData(prev => ({
          ...prev,
          ...data // Preenche automaticamente os campos técnicos
        }));
      } else {
        alert('Placa não encontrada na base nacional.');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plate || !formData.associateId) {
        alert('Placa e Proprietário são obrigatórios.');
        return;
    }

    setIsSubmitting(true);
    try {
        const newVehicle: Vehicle = {
            id: Math.random().toString(36).substr(2, 9),
            createdAt: new Date().toISOString(),
            ...formData as Vehicle
        };
        
        const updated = [newVehicle, ...vehicles];
        setVehicles(updated);
        mockStorage.set('vehicles', updated);
        setIsModalOpen(false);
        setFormData({ plate: '', associateId: '', km: 0, status: 'Ativo', notes: '' });
    } finally {
        setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.includes(searchTerm.toUpperCase()) || 
    v.model?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
            <h2 className="text-3xl font-black text-slate-800">Gestão de Veículos</h2>
            <p className="text-sm text-slate-500">Cadastro simplificado com busca automática.</p>
        </div>
        <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl transition-all">
            <Plus size={18}/> Novo Veículo
        </button>
      </div>

      {/* Lista */}
      <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
         <div className="flex justify-between items-center mb-6">
            <div className="relative w-96">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
                <input className="w-full pl-12 p-3 bg-slate-50 rounded-xl outline-none font-bold text-slate-600" placeholder="Buscar placa..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            </div>
            <div className="flex bg-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg ${viewMode === 'grid' ? 'bg-white shadow' : ''}`}><LayoutGrid size={18}/></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg ${viewMode === 'list' ? 'bg-white shadow' : ''}`}><List size={18}/></button>
            </div>
         </div>

         {loading ? <div className="text-center py-10"><Loader2 className="animate-spin mx-auto text-blue-600"/></div> : (
            <div className={`grid gap-4 ${viewMode === 'grid' ? 'grid-cols-3' : 'grid-cols-1'}`}>
                {filteredVehicles.map(v => (
                    <div key={v.id} className="p-5 border border-slate-100 rounded-3xl hover:border-blue-200 transition-all bg-slate-50/50">
                        <div className="flex justify-between items-start mb-4">
                            <div className="bg-slate-800 text-white px-3 py-1 rounded-lg font-black tracking-widest text-sm">{v.plate}</div>
                            <span className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${v.status === 'Ativo' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{v.status}</span>
                        </div>
                        <h4 className="font-black text-slate-800 uppercase text-sm truncate">{v.model || 'Desconhecido'}</h4>
                        <p className="text-xs text-slate-500 font-bold uppercase mb-4">{v.brand} • {v.yearModel}</p>
                        
                        <div className="pt-4 border-t border-slate-200 flex justify-between items-center text-xs">
                            <span className="font-bold text-slate-600 flex items-center gap-1"><User size={12}/> {associates.find(a => a.id === v.associateId)?.name || 'N/A'}</span>
                            <span className="font-mono text-slate-400">{v.km} km</span>
                        </div>
                    </div>
                ))}
            </div>
         )}
      </div>

      {/* Modal Simplificado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setIsModalOpen(false)}></div>
            <div className="relative bg-white w-full max-w-3xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><Car className="text-blue-600"/> Cadastro Inteligente</h3>
                    <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400"/></button>
                </div>
                
                <form onSubmit={handleSave} className="p-8 space-y-8">
                    {/* Seção 1: Entrada do Usuário */}
                    <section>
                        <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">1. Identificação Básica</h4>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="relative">
                                <label className="block text-xs font-bold text-slate-600 mb-1">Placa *</label>
                                <input 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xl uppercase outline-none focus:border-blue-500 tracking-widest"
                                    placeholder="ABC1D23"
                                    maxLength={7}
                                    value={formData.plate}
                                    onChange={e => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                                    onBlur={handlePlateLookup}
                                />
                                <div className="absolute right-4 top-9 text-blue-600">
                                    {isSearchingPlate ? <Loader2 className="animate-spin"/> : <CloudLightning size={20}/>}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-600 mb-1">Proprietário *</label>
                                <select 
                                    className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-sm outline-none"
                                    value={formData.associateId}
                                    onChange={e => setFormData({...formData, associateId: e.target.value})}
                                >
                                    <option value="">Selecione...</option>
                                    {associates.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                                </select>
                            </div>
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

                    {/* Seção 2: Dados Automáticos (Read-onlyish) */}
                    <section className="bg-slate-50 p-6 rounded-[32px] border border-slate-100">
                        <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-4 flex items-center gap-2">
                            <CloudLightning size={14}/> Dados Técnicos (Automático)
                        </h4>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="col-span-1">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Marca</label>
                                <input className="w-full bg-transparent font-black text-slate-800 border-b border-slate-200 py-1 outline-none" 
                                    value={formData.brand} onChange={e => setFormData({...formData, brand: e.target.value})} placeholder="---"/>
                            </div>
                            <div className="col-span-2">
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Modelo</label>
                                <input className="w-full bg-transparent font-black text-slate-800 border-b border-slate-200 py-1 outline-none" 
                                    value={formData.model} onChange={e => setFormData({...formData, model: e.target.value})} placeholder="---"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Ano/Mod</label>
                                <input className="w-full bg-transparent font-bold text-slate-600 border-b border-slate-200 py-1 outline-none" 
                                    value={formData.yearModel} onChange={e => setFormData({...formData, yearModel: e.target.value})} placeholder="---"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Cor</label>
                                <input className="w-full bg-transparent font-bold text-slate-600 border-b border-slate-200 py-1 outline-none" 
                                    value={formData.color} onChange={e => setFormData({...formData, color: e.target.value})} placeholder="---"/>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-slate-400 uppercase">Chassi</label>
                                <input className="w-full bg-transparent font-bold text-slate-600 border-b border-slate-200 py-1 outline-none" 
                                    value={formData.chassi} onChange={e => setFormData({...formData, chassi: e.target.value})} placeholder="---"/>
                            </div>
                        </div>
                    </section>

                    <div className="flex justify-end pt-4">
                        <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl flex items-center gap-2">
                            {isSubmitting ? <Loader2 className="animate-spin"/> : <><Save size={18}/> Salvar Veículo</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
