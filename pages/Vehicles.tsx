
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Car, Hash, ShieldCheck, 
  X, AlertCircle, Loader2, MoreVertical, ClipboardList
} from 'lucide-react';
import { vehicleService } from '../services/vehicleService';
import { isSupabaseConfigured } from '../services/supabaseClient';
import { Vehicle } from '../types';

const Vehicles: React.FC = () => {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    plate: '',
    renavam: '',
    chassi: '',
    model: '',
    brand: '',
    year: '',
    associateId: 'a1' // Vinculado ao primeiro associado mock por padrão
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadVehicles();
  }, []);

  async function loadVehicles() {
    try {
      setLoading(true);
      const data = await vehicleService.getVehicles();
      setVehicles(data);
    } catch (err) {
      console.error("Erro ao carregar veículos:", err);
    } finally {
      setLoading(false);
    }
  }

  const validateForm = async () => {
    const newErrors: Record<string, string> = {};

    if (!formData.plate) newErrors.plate = 'Placa é obrigatória';
    if (!formData.model) newErrors.model = 'Modelo é obrigatório';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setIsSubmitting(true);
    try {
      const plateExists = await vehicleService.checkDuplicity('plate', formData.plate);
      if (plateExists) newErrors.plate = 'Esta placa já está cadastrada no sistema';

      if (formData.renavam) {
        const renavamExists = await vehicleService.checkDuplicity('renavam', formData.renavam);
        if (renavamExists) newErrors.renavam = 'Renavam já vinculado';
      }
    } catch (e) {
      console.error("Erro na validação:", e);
    } finally {
      setIsSubmitting(false);
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      await vehicleService.createVehicle(formData);
      await loadVehicles();
      setIsModalOpen(false);
      setFormData({ plate: '', renavam: '', chassi: '', model: '', brand: '', year: '', associateId: 'a1' });
    } catch (err: any) {
      setErrors({ global: err.message || 'Erro ao salvar veículo' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">Frota de Veículos</h2>
          <p className="text-sm text-slate-500 font-medium">Controle total de placas, renavams e chassis cadastrados.</p>
        </div>
        <div className="flex gap-4">
           {!isSupabaseConfigured && (
             <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl border border-blue-100 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest">
               <ShieldCheck size={14}/> Modo Local Ativo
             </div>
           )}
           <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
          >
            <Plus size={20} /> Novo Veículo
          </button>
        </div>
      </div>

      <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200">
        <div className="relative max-w-xl">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por placa, modelo ou fabricante..."
            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white p-8 rounded-[40px] shadow-sm border border-slate-200 hover:border-blue-200 transition-all group relative overflow-hidden">
              <div className="flex justify-between items-start mb-6">
                <div className="bg-slate-900 px-4 py-2 rounded-2xl border-4 border-slate-800 text-white font-black tracking-[0.2em] text-xl shadow-lg shadow-slate-900/10">
                  {vehicle.plate}
                </div>
                <button className="p-2 text-slate-300 hover:text-slate-600 transition-colors">
                  <MoreVertical size={24} />
                </button>
              </div>
              <h3 className="font-black text-slate-800 text-xl tracking-tight uppercase leading-none mb-1">{vehicle.model}</h3>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-6">{vehicle.brand} • {vehicle.year}</p>
              
              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-black uppercase tracking-widest">Renavam</span>
                  <span className="text-slate-700 font-black bg-slate-50 px-3 py-1 rounded-xl border border-slate-100">{vehicle.renavam || 'PENDENTE'}</span>
                </div>
                <div className="flex justify-between items-center text-[10px]">
                  <span className="text-slate-400 font-black uppercase tracking-widest">Chassi</span>
                  <span className="text-slate-700 font-black bg-slate-50 px-3 py-1 rounded-xl border border-slate-100 truncate max-w-[150px]">{vehicle.chassi || 'PENDENTE'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredVehicles.length === 0 && (
            <div className="col-span-full py-32 text-center bg-white rounded-[48px] border-4 border-dashed border-slate-100">
               <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Car size={48} className="text-slate-200" />
               </div>
               <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhum veículo encontrado na frota</p>
            </div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-4">
                <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-600/30">
                  <Car size={32} />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-slate-800 tracking-tight leading-none">Cadastrar Veículo</h3>
                  <p className="text-xs text-slate-500 font-medium mt-1">Insira os dados técnicos do ativo.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={32}/></button>
            </div>

            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Placa Mercosul/Brasil *</label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      required
                      className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl font-black uppercase outline-none transition-all text-lg tracking-[0.2em] ${errors.plate ? 'border-red-300 ring-red-100 ring-4' : 'border-slate-100 focus:ring-4 focus:ring-blue-500/5'}`}
                      placeholder="ABC1D23"
                      value={formData.plate}
                      onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                    />
                  </div>
                  {errors.plate && <p className="text-[10px] text-red-500 mt-2 font-black uppercase flex items-center gap-1"><AlertCircle size={12}/> {errors.plate}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Código Renavam</label>
                  <div className="relative">
                    <ClipboardList className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm"
                      placeholder="00123456789"
                      maxLength={11}
                      value={formData.renavam}
                      onChange={(e) => setFormData({...formData, renavam: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Chassi Completo</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm tracking-widest"
                      placeholder="9BWZZZ37Z2T000001"
                      maxLength={17}
                      value={formData.chassi}
                      onChange={(e) => setFormData({...formData, chassi: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Modelo do Veículo *</label>
                  <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm" value={formData.model} onChange={(e) => setFormData({...formData, model: e.target.value})} />
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fabricante</label>
                  <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm" value={formData.brand} onChange={(e) => setFormData({...formData, brand: e.target.value})} />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-8 border-t border-slate-50 items-center">
                <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-400 font-black uppercase text-[12px] tracking-widest hover:text-slate-600 transition-colors">CANCELAR</button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-12 py-5 bg-blue-600 text-white rounded-[24px] font-black shadow-2xl shadow-blue-600/30 uppercase text-xs tracking-widest hover:bg-blue-700 transition-all flex items-center gap-3 disabled:opacity-50"
                >
                  {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : 'SALVAR VEÍCULO'}
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
