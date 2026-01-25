
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
    associateId: ''
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
      setVehicles(data || []);
    } catch (err) {
      console.error("Erro ao carregar veículos:", err);
    } finally {
      setLoading(false);
    }
  }

  const validateForm = async () => {
    const newErrors: Record<string, string> = {};

    // Validações de campos vazios
    if (!formData.plate) newErrors.plate = 'Placa é obrigatória';
    if (!formData.model) newErrors.model = 'Modelo é obrigatório';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    // Validação de unicidade no Banco de Dados
    setIsSubmitting(true);
    try {
      const plateExists = await vehicleService.checkDuplicity('plate', formData.plate);
      if (plateExists) newErrors.plate = 'Esta placa já está cadastrada no sistema';

      if (formData.renavam) {
        const renavamExists = await vehicleService.checkDuplicity('renavam', formData.renavam);
        if (renavamExists) newErrors.renavam = 'Este Renavam já está vinculado a outro veículo';
      }

      if (formData.chassi) {
        const chassiExists = await vehicleService.checkDuplicity('chassi', formData.chassi);
        if (chassiExists) newErrors.chassi = 'Este Chassi já existe em nossa base de dados';
      }
    } catch (e) {
      console.error("Erro na validação de unicidade:", e);
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
    if (!isSupabaseConfigured) {
      // Simulação em caso de não configurado
      const newVeh: Vehicle = {
        id: Math.random().toString(),
        ...formData,
        createdAt: new Date().toISOString()
      };
      setVehicles([newVeh, ...vehicles]);
      setIsModalOpen(false);
      return;
    }

    setErrors({});
    const isValid = await validateForm();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      await vehicleService.createVehicle(formData);
      await loadVehicles();
      setIsModalOpen(false);
      setFormData({ plate: '', renavam: '', chassi: '', model: '', brand: '', year: '', associateId: '' });
    } catch (err: any) {
      setErrors({ global: err.message || 'Erro ao salvar veículo no servidor' });
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
      {!isSupabaseConfigured && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-center gap-3 text-amber-700 shadow-sm animate-pulse">
          <AlertCircle size={20} />
          <p className="text-sm font-medium">Modo de Visualização: O banco de dados não está conectado. As alterações não serão salvas.</p>
        </div>
      )}

      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Frota de Veículos</h2>
          <p className="text-sm text-slate-500 font-medium">Controle total de placas, renavams e chassis cadastrados.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus size={20} /> Novo Veículo
        </button>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por placa ou modelo..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-100 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {loading && isSupabaseConfigured ? (
        <div className="flex justify-center py-20">
          <Loader2 className="animate-spin text-blue-600" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVehicles.map((vehicle) => (
            <div key={vehicle.id} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-200 transition-all group">
              <div className="flex justify-between items-start mb-4">
                <div className="bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-700 text-white font-black tracking-widest text-lg shadow-sm">
                  {vehicle.plate}
                </div>
                <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                  <MoreVertical size={20} />
                </button>
              </div>
              <h3 className="font-bold text-slate-800 text-lg uppercase">{vehicle.model}</h3>
              <p className="text-sm text-slate-500 font-medium mb-4">{vehicle.brand} • {vehicle.year}</p>
              
              <div className="space-y-3 pt-4 border-t border-slate-50">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Renavam</span>
                  <span className="text-slate-700 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">{vehicle.renavam || 'Não informado'}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-400 font-bold uppercase tracking-widest">Chassi</span>
                  <span className="text-slate-700 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100 truncate max-w-[140px]" title={vehicle.chassi}>{vehicle.chassi || 'Não informado'}</span>
                </div>
              </div>
            </div>
          ))}
          {filteredVehicles.length === 0 && (!loading || !isSupabaseConfigured) && (
            <div className="col-span-full py-20 text-center bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
               <Car size={48} className="mx-auto text-slate-300 mb-4" />
               <p className="text-slate-500 font-medium">Nenhum veículo encontrado com os critérios de busca.</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de Cadastro Refinado */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-8 duration-300">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-600/20">
                  <Car size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-slate-800 leading-tight">Cadastrar Veículo</h3>
                  <p className="text-xs text-slate-500 font-medium">Campos com asterisco são obrigatórios.</p>
                </div>
              </div>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-800 rounded-full transition-all hover:bg-slate-100"><X size={20}/></button>
            </div>

            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Placa */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Placa Mercosul/Brasil *</label>
                  <div className="relative">
                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl font-black uppercase outline-none focus:ring-2 transition-all text-sm tracking-widest ${errors.plate ? 'border-red-300 ring-red-100 ring-4' : 'border-slate-100 focus:ring-blue-500/20 focus:border-blue-500'}`}
                      placeholder="ABC1D23"
                      value={formData.plate}
                      onChange={(e) => setFormData({...formData, plate: e.target.value.toUpperCase()})}
                    />
                  </div>
                  {errors.plate && <p className="text-[10px] text-red-500 mt-1.5 font-bold flex items-center gap-1 animate-in slide-in-from-left-2"><AlertCircle size={10}/> {errors.plate}</p>}
                </div>

                {/* Renavam */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Código Renavam (Opcional)</label>
                  <div className="relative">
                    <ClipboardList className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl font-mono outline-none focus:ring-2 transition-all text-sm ${errors.renavam ? 'border-red-300 ring-red-100 ring-4' : 'border-slate-100 focus:ring-blue-500/20 focus:border-blue-500'}`}
                      placeholder="00123456789"
                      maxLength={11}
                      value={formData.renavam}
                      onChange={(e) => setFormData({...formData, renavam: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                  {errors.renavam && <p className="text-[10px] text-red-500 mt-1.5 font-bold flex items-center gap-1 animate-in slide-in-from-left-2"><AlertCircle size={10}/> {errors.renavam}</p>}
                </div>

                {/* Chassi */}
                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Chassi Completo (17 caracteres - Opcional)</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                    <input 
                      className={`w-full pl-10 pr-4 py-3 bg-slate-50 border rounded-xl font-mono font-bold uppercase outline-none focus:ring-2 transition-all text-sm ${errors.chassi ? 'border-red-300 ring-red-100 ring-4' : 'border-slate-100 focus:ring-blue-500/20 focus:border-blue-500'}`}
                      placeholder="9BWZZZ37Z2T000001"
                      maxLength={17}
                      value={formData.chassi}
                      onChange={(e) => setFormData({...formData, chassi: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                    />
                  </div>
                  {errors.chassi && <p className="text-[10px] text-red-500 mt-1.5 font-bold flex items-center gap-1 animate-in slide-in-from-left-2"><AlertCircle size={10}/> {errors.chassi}</p>}
                </div>

                {/* Modelo */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Modelo do Veículo *</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    placeholder="Ex: Corolla XEI 2.0"
                    value={formData.model}
                    onChange={(e) => setFormData({...formData, model: e.target.value})}
                  />
                </div>

                {/* Ano */}
                <div>
                  <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ano Fab/Mod</label>
                  <input 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-100 rounded-xl font-medium outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm"
                    placeholder="Ex: 2022/2023"
                    value={formData.year}
                    onChange={(e) => setFormData({...formData, year: e.target.value})}
                  />
                </div>
              </div>

              {errors.global && (
                <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-xs font-bold">
                  <AlertCircle size={14} /> {errors.global}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button 
                  type="button" 
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)} 
                  className="px-6 py-2.5 text-slate-400 font-bold hover:text-slate-600 transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="px-10 py-3 bg-blue-600 text-white rounded-xl font-black shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all uppercase text-xs tracking-widest flex items-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="animate-spin" size={16} />
                      Validando...
                    </>
                  ) : 'Salvar Veículo'}
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
