
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, Car, Hash, ShieldCheck, 
  X, AlertCircle, Loader2, MoreVertical, ClipboardList,
  CloudLightning, Users, FileText, Phone, Mail, User,
  LayoutGrid, List, Trash2, Edit, CheckCircle2
} from 'lucide-react';
import { vehicleService } from '../services/vehicleService';
import { lookupService } from '../services/lookupService';
import { isSupabaseConfigured, mockStorage } from '../services/supabaseClient';
import { Vehicle } from '../types';
import { MOCK_ASSOCIATES } from '../constants';

// Interface local para Associados
interface Associate {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  type: 'PF' | 'PJ';
}

const Vehicles: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'veiculos' | 'associados'>('veiculos');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid'); // Novo estado para controle de visualização
  
  // Veículos States
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [isVehicleModalOpen, setIsVehicleModalOpen] = useState(false);
  const [vehicleSearchTerm, setVehicleSearchTerm] = useState('');
  
  // Associados States
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [isAssociateModalOpen, setIsAssociateModalOpen] = useState(false);
  const [associateSearchTerm, setAssociateSearchTerm] = useState('');
  const [editingAssociate, setEditingAssociate] = useState<Associate | null>(null);

  // Estados para busca de placa
  const [isSearchingPlate, setIsSearchingPlate] = useState(false);
  const [plateMessage, setPlateMessage] = useState<string | null>(null);
  const [foundVehicleData, setFoundVehicleData] = useState<boolean>(false);

  // Forms
  const [vehicleFormData, setVehicleFormData] = useState({
    plate: '',
    renavam: '',
    chassi: '',
    model: '',
    brand: '',
    year: '',
    associateId: '' 
  });

  const [associateFormData, setAssociateFormData] = useState<Associate>({
    id: '',
    name: '',
    document: '',
    email: '',
    phone: '',
    type: 'PF'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      // Carregar Veículos
      const vehicleData = await vehicleService.getVehicles();
      setVehicles(vehicleData);

      // Carregar Associados (Mock ou Storage)
      const storedAssociates = mockStorage.get('associates');
      if (storedAssociates) {
        setAssociates(storedAssociates);
      } else {
        // Converter Mock Constants para formato local se necessário
        const initialAssociates = MOCK_ASSOCIATES.map(a => ({
            id: a.id,
            name: a.name,
            document: a.document,
            type: a.type as 'PF' | 'PJ',
            email: 'pendente@email.com',
            phone: '11999999999'
        }));
        setAssociates(initialAssociates);
        mockStorage.set('associates', initialAssociates);
      }

    } catch (err) {
      console.error("Erro ao carregar dados:", err);
    } finally {
      setLoading(false);
    }
  }

  // --- LÓGICA DE VEÍCULOS ---

  const handlePlateLookup = async () => {
    if (vehicleFormData.plate.length < 7) return;

    setIsSearchingPlate(true);
    setPlateMessage('Consultando base DETRAN/FIPE...');
    setFoundVehicleData(false);

    try {
      const data = await lookupService.fetchPlate(vehicleFormData.plate);
      
      if (data) {
        setVehicleFormData(prev => ({
          ...prev,
          model: data.model,
          brand: data.brand,
          year: data.year,
          chassi: data.chassi || prev.chassi 
        }));
        setPlateMessage(`${data.brand} ${data.model} encontrado.`);
        setFoundVehicleData(true);
      } else {
        setPlateMessage('Placa não encontrada nas bases públicas.');
      }
    } catch (err) {
      setPlateMessage('Erro ao consultar placa.');
    } finally {
      setIsSearchingPlate(false);
    }
  };

  const validateVehicleForm = async () => {
    const newErrors: Record<string, string> = {};

    if (!vehicleFormData.plate) newErrors.plate = 'Placa é obrigatória';
    if (!vehicleFormData.model) newErrors.model = 'Modelo é obrigatório';
    if (!vehicleFormData.associateId) newErrors.associateId = 'Obrigatório vincular um associado';

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    setIsSubmitting(true);
    try {
      const plateExists = await vehicleService.checkDuplicity('plate', vehicleFormData.plate);
      if (plateExists) newErrors.plate = 'Esta placa já está cadastrada no sistema';
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

  const handleSaveVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    const isValid = await validateVehicleForm();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      await vehicleService.createVehicle(vehicleFormData);
      await loadData(); // Recarrega tudo
      setIsVehicleModalOpen(false);
      setVehicleFormData({ plate: '', renavam: '', chassi: '', model: '', brand: '', year: '', associateId: '' });
      setPlateMessage(null);
      setFoundVehicleData(false);
    } catch (err: any) {
      setErrors({ global: err.message || 'Erro ao salvar veículo' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- LÓGICA DE ASSOCIADOS ---

  const handleOpenAssociateModal = (associate?: Associate) => {
    if (associate) {
        setEditingAssociate(associate);
        setAssociateFormData(associate);
    } else {
        setEditingAssociate(null);
        setAssociateFormData({
            id: '',
            name: '',
            document: '',
            email: '',
            phone: '',
            type: 'PF'
        });
    }
    setIsAssociateModalOpen(true);
  };

  const handleSaveAssociate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!associateFormData.name || !associateFormData.document) return;

    const newAssociate = {
        ...associateFormData,
        id: editingAssociate ? editingAssociate.id : Math.random().toString(36).substr(2, 9)
    };

    let updatedList;
    if (editingAssociate) {
        updatedList = associates.map(a => a.id === editingAssociate.id ? newAssociate : a);
    } else {
        updatedList = [...associates, newAssociate];
    }

    setAssociates(updatedList);
    mockStorage.set('associates', updatedList);
    setIsAssociateModalOpen(false);
  };

  // --- FILTROS ---

  const filteredVehicles = vehicles.filter(v => 
    v.plate.toLowerCase().includes(vehicleSearchTerm.toLowerCase()) ||
    v.model.toLowerCase().includes(vehicleSearchTerm.toLowerCase())
  );

  const filteredAssociates = associates.filter(a => 
    a.name.toLowerCase().includes(associateSearchTerm.toLowerCase()) ||
    a.document.includes(associateSearchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 tracking-tight">
             {activeTab === 'veiculos' ? 'Frota de Veículos' : 'Gestão de Associados'}
          </h2>
          <p className="text-sm text-slate-500 font-medium">
             {activeTab === 'veiculos' ? 'Controle total de placas, renavams e chassis.' : 'Cadastro de proprietários e condutores.'}
          </p>
        </div>
        <div className="flex items-center gap-4">
           {!isSupabaseConfigured && (
             <div className="bg-blue-50 text-blue-600 px-4 py-2 rounded-2xl border border-blue-100 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest hidden md:flex">
               <ShieldCheck size={14}/> Modo Local Ativo
             </div>
           )}
           {activeTab === 'veiculos' ? (
             <button 
                onClick={() => { setIsVehicleModalOpen(true); setVehicleFormData({ plate: '', renavam: '', chassi: '', model: '', brand: '', year: '', associateId: '' }); setPlateMessage(null); setFoundVehicleData(false); }}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
             >
                <Plus size={20} /> Novo Veículo
             </button>
           ) : (
             <button 
                onClick={() => handleOpenAssociateModal()}
                className="flex items-center gap-2 px-8 py-3 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-[0.2em] hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20"
             >
                <Plus size={20} /> Novo Associado
             </button>
           )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white p-2 rounded-2xl border border-slate-200 shadow-sm inline-flex">
         <button 
            onClick={() => { setActiveTab('veiculos'); setViewMode('grid'); }}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'veiculos' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
         >
            Veículos ({vehicles.length})
         </button>
         <button 
            onClick={() => { setActiveTab('associados'); setViewMode('grid'); }}
            className={`px-6 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === 'associados' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'}`}
         >
            Associados ({associates.length})
         </button>
      </div>

      {/* TAB VEÍCULOS */}
      {activeTab === 'veiculos' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-6">
            <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-200 flex flex-col md:flex-row gap-4 items-center justify-between">
                <div className="relative w-full max-w-xl">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                        type="text" 
                        placeholder="Buscar por placa, modelo ou fabricante..."
                        className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl focus:ring-4 focus:ring-blue-500/10 outline-none text-sm font-medium transition-all"
                        value={vehicleSearchTerm}
                        onChange={(e) => setVehicleSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                   <button 
                      onClick={() => setViewMode('grid')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                      <LayoutGrid size={20} />
                   </button>
                   <button 
                      onClick={() => setViewMode('list')}
                      className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                   >
                      <List size={20} />
                   </button>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <Loader2 className="animate-spin text-blue-600" size={40} />
                </div>
            ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in slide-in-from-bottom-2 duration-300">
                {filteredVehicles.map((vehicle) => {
                    const owner = associates.find(a => a.id === vehicle.associateId);
                    return (
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
                        
                        <div className="bg-slate-50 p-4 rounded-2xl mb-4 border border-slate-100">
                            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Proprietário</p>
                            <div className="flex items-center gap-2">
                                <User size={16} className="text-blue-600"/>
                                <p className="text-xs font-bold text-slate-700 truncate">{owner ? owner.name : 'Não vinculado'}</p>
                            </div>
                        </div>

                        <div className="space-y-3 pt-4 border-t border-slate-50">
                            <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-black uppercase tracking-widest">Renavam</span>
                            <span className="text-slate-700 font-bold">{vehicle.renavam || '-'}</span>
                            </div>
                            <div className="flex justify-between items-center text-[10px]">
                            <span className="text-slate-400 font-black uppercase tracking-widest">Chassi</span>
                            <span className="text-slate-700 font-bold truncate max-w-[150px]">{vehicle.chassi || '-'}</span>
                            </div>
                        </div>
                        </div>
                    );
                })}
                </div>
            ) : (
                <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in slide-in-from-bottom-2 duration-300">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa / Modelo</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Ano / Fabricante</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Associado</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Dados Técnicos</th>
                        <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {filteredVehicles.map(vehicle => {
                        const owner = associates.find(a => a.id === vehicle.associateId);
                        return (
                          <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors group">
                            <td className="px-8 py-5">
                              <span className="font-black text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 text-xs inline-block mb-1">{vehicle.plate}</span>
                              <p className="text-xs font-bold text-slate-600 uppercase">{vehicle.model}</p>
                            </td>
                            <td className="px-8 py-5">
                              <p className="font-bold text-slate-800 text-sm">{vehicle.year}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase">{vehicle.brand}</p>
                            </td>
                            <td className="px-8 py-5">
                              {owner ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-[10px] font-bold">{owner.name.charAt(0)}</div>
                                    <span className="text-xs font-bold text-slate-700">{owner.name}</span>
                                </div>
                              ) : <span className="text-slate-400 text-xs italic">Não vinculado</span>}
                            </td>
                            <td className="px-8 py-5">
                                <p className="text-[10px] text-slate-500"><strong className="text-slate-400 uppercase">Renavam:</strong> {vehicle.renavam || '-'}</p>
                                <p className="text-[10px] text-slate-500"><strong className="text-slate-400 uppercase">Chassi:</strong> {vehicle.chassi || '-'}</p>
                            </td>
                            <td className="px-8 py-5 text-right flex justify-end gap-2">
                               <button className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit size={16}/></button>
                               <button className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={16}/></button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
            )}
            
            {filteredVehicles.length === 0 && !loading && (
                <div className="col-span-full py-32 text-center bg-white rounded-[48px] border-4 border-dashed border-slate-100">
                <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Car size={48} className="text-slate-200" />
                </div>
                <p className="text-slate-400 font-black uppercase text-xs tracking-[0.3em]">Nenhum veículo encontrado na frota</p>
                </div>
            )}
        </div>
      )}

      {/* --- MODAIS --- */}

      {/* Modal Veículo */}
      {isVehicleModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => !isSubmitting && setIsVehicleModalOpen(false)}></div>
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
              <button onClick={() => setIsVehicleModalOpen(false)} className="p-2 text-slate-300 hover:text-slate-600 transition-colors"><X size={32}/></button>
            </div>

            <form onSubmit={handleSaveVehicle} className="p-10 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <label className="flex justify-between items-end text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
                    <span>Placa Mercosul/Brasil *</span>
                  </label>
                  <div className="relative">
                    <Hash className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      required
                      className={`w-full pl-12 pr-12 py-4 bg-slate-50 border rounded-2xl font-black uppercase outline-none transition-all text-lg tracking-[0.2em] ${errors.plate ? 'border-red-300 ring-red-100 ring-4' : 'border-slate-100 focus:ring-4 focus:ring-blue-500/5'} ${isSearchingPlate ? 'opacity-70' : ''}`}
                      placeholder="ABC1D23"
                      maxLength={7}
                      value={vehicleFormData.plate}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, plate: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                      onBlur={handlePlateLookup}
                    />
                    <button 
                        type="button" 
                        onClick={handlePlateLookup}
                        disabled={isSearchingPlate}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-blue-50 text-blue-600 rounded-xl hover:bg-blue-100 transition-colors" 
                        title="Buscar Placa"
                    >
                        {isSearchingPlate ? <Loader2 className="animate-spin" size={18}/> : <CloudLightning size={18}/>}
                    </button>
                  </div>
                  {/* Mensagem de Feedback Reposicionada */}
                  {plateMessage && (
                      <div className={`mt-2 p-2 rounded-lg text-[10px] font-bold flex items-center gap-2 ${foundVehicleData ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'}`}>
                          {foundVehicleData ? <CheckCircle2 size={12}/> : <AlertCircle size={12}/>}
                          {plateMessage}
                      </div>
                  )}
                  {errors.plate && <p className="text-[10px] text-red-500 mt-2 font-black uppercase flex items-center gap-1"><AlertCircle size={12}/> {errors.plate}</p>}
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Associado Responsável *</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <select 
                        className={`w-full pl-12 pr-4 py-4 bg-slate-50 border rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm appearance-none ${errors.associateId ? 'border-red-300' : 'border-slate-100'}`}
                        value={vehicleFormData.associateId}
                        onChange={e => setVehicleFormData({...vehicleFormData, associateId: e.target.value})}
                    >
                        <option value="">Selecione o Dono...</option>
                        {associates.map(a => (
                            <option key={a.id} value={a.id}>{a.name} ({a.document})</option>
                        ))}
                    </select>
                  </div>
                  {errors.associateId && <p className="text-[10px] text-red-500 mt-2 font-black uppercase flex items-center gap-1"><AlertCircle size={12}/> {errors.associateId}</p>}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Chassi Completo</label>
                  <div className="relative">
                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
                    <input 
                      className={`w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-black uppercase outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm tracking-widest ${foundVehicleData ? 'text-blue-600 bg-blue-50/30' : ''}`}
                      placeholder="9BWZZZ37Z2T000001"
                      maxLength={17}
                      value={vehicleFormData.chassi}
                      onChange={(e) => setVehicleFormData({...vehicleFormData, chassi: e.target.value.toUpperCase()})}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Modelo do Veículo *</label>
                  <input required className={`w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm ${foundVehicleData ? 'text-blue-600 bg-blue-50/30' : ''}`} value={vehicleFormData.model} onChange={(e) => setVehicleFormData({...vehicleFormData, model: e.target.value})} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Fabricante</label>
                      <input className={`w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm ${foundVehicleData ? 'text-blue-600 bg-blue-50/30' : ''}`} value={vehicleFormData.brand} onChange={(e) => setVehicleFormData({...vehicleFormData, brand: e.target.value})} />
                   </div>
                   <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Ano</label>
                      <input className={`w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all text-sm ${foundVehicleData ? 'text-blue-600 bg-blue-50/30' : ''}`} value={vehicleFormData.year} onChange={(e) => setVehicleFormData({...vehicleFormData, year: e.target.value})} />
                   </div>
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-8 border-t border-slate-50 items-center">
                <button type="button" onClick={() => setIsVehicleModalOpen(false)} className="text-slate-400 font-black uppercase text-[12px] tracking-widest hover:text-slate-600 transition-colors">CANCELAR</button>
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

      {/* Modal Associado */}
      {isAssociateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsAssociateModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-lg rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-xl font-black text-slate-800">{editingAssociate ? 'Editar Associado' : 'Novo Associado'}</h3>
               <button onClick={() => setIsAssociateModalOpen(false)}><X className="text-slate-400" size={24}/></button>
             </div>
             <form onSubmit={handleSaveAssociate} className="p-8 space-y-6">
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Nome Completo / Razão Social</label>
                   <input required className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                      value={associateFormData.name} onChange={e => setAssociateFormData({...associateFormData, name: e.target.value})} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                   <div className="col-span-1">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Tipo</label>
                      <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none"
                         value={associateFormData.type} onChange={e => setAssociateFormData({...associateFormData, type: e.target.value as 'PF' | 'PJ'})}>
                         <option value="PF">Pessoa Física</option>
                         <option value="PJ">Pessoa Jurídica</option>
                      </select>
                   </div>
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">CPF / CNPJ</label>
                      <div className="relative">
                         <FileText className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                         <input required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" 
                            value={associateFormData.document} onChange={e => setAssociateFormData({...associateFormData, document: e.target.value})} />
                      </div>
                   </div>
                </div>
                <div>
                   <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Contatos</label>
                   <div className="space-y-3">
                      <div className="relative">
                         <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                         <input className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="Telefone/WhatsApp"
                            value={associateFormData.phone} onChange={e => setAssociateFormData({...associateFormData, phone: e.target.value})} />
                      </div>
                      <div className="relative">
                         <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={18}/>
                         <input type="email" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold outline-none" placeholder="E-mail principal"
                            value={associateFormData.email} onChange={e => setAssociateFormData({...associateFormData, email: e.target.value})} />
                      </div>
                   </div>
                </div>
                <div className="pt-6 border-t border-slate-100 flex justify-end gap-3">
                   <button type="button" onClick={() => setIsAssociateModalOpen(false)} className="px-6 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                   <button type="submit" className="px-8 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl">Salvar Associado</button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vehicles;
