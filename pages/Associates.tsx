
import React, { useState, useEffect } from 'react';
import { 
  Plus, Search, UserCheck, Edit3, Trash2, X, Save, 
  Car, LayoutGrid, List, Phone, Mail, Shield, User, Loader2
} from 'lucide-react';
import { mockStorage } from '../services/supabaseClient';
import { Vehicle } from '../types';

interface Associate {
  id: string;
  name: string;
  document: string; // CPF ou CNPJ
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  createdAt: string;
}

const Associates: React.FC = () => {
  const [associates, setAssociates] = useState<Associate[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Dados de edição
  const [associateToEdit, setAssociateToEdit] = useState<Associate | null>(null);
  
  // Estado do Formulário
  const [formData, setFormData] = useState({
    name: '',
    document: '',
    type: 'PF' as 'PF' | 'PJ',
    email: '',
    phone: '',
    linkedPlate: '' // Campo novo para vincular carro
  });

  useEffect(() => {
    loadAssociates();
  }, []);

  const loadAssociates = () => {
    const data = mockStorage.get('associates') || [];
    setAssociates(data);
  };

  const handleOpenModal = (associate?: Associate) => {
    if (associate) {
      setAssociateToEdit(associate);
      setFormData({
        name: associate.name,
        document: associate.document,
        type: associate.type,
        email: associate.email || '',
        phone: associate.phone || '',
        linkedPlate: '' // Não carregamos a placa na edição para simplificar, apenas na criação
      });
    } else {
      setAssociateToEdit(null);
      setFormData({
        name: '',
        document: '',
        type: 'PF',
        email: '',
        phone: '',
        linkedPlate: ''
      });
    }
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Tem certeza que deseja excluir este associado? Os veículos vinculados ficarão sem proprietário.')) {
      const updated = associates.filter(a => a.id !== id);
      setAssociates(updated);
      mockStorage.set('associates', updated);
      
      // Opcional: Atualizar veículos para remover o associateId
      const vehicles: Vehicle[] = mockStorage.get('vehicles') || [];
      const updatedVehicles = vehicles.map(v => v.associateId === id ? { ...v, associateId: '' } : v);
      mockStorage.set('vehicles', updatedVehicles);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.document) return;
    
    setIsSubmitting(true);

    // Simular delay de rede
    await new Promise(r => setTimeout(r, 600));

    const newId = associateToEdit ? associateToEdit.id : Math.random().toString(36).substr(2, 9);
    
    const newAssociate: Associate = {
      id: newId,
      name: formData.name,
      document: formData.document,
      type: formData.type,
      email: formData.email,
      phone: formData.phone,
      createdAt: associateToEdit ? associateToEdit.createdAt : new Date().toISOString()
    };

    // 1. Salvar Associado
    let updatedAssociates;
    if (associateToEdit) {
      updatedAssociates = associates.map(a => a.id === associateToEdit.id ? newAssociate : a);
    } else {
      updatedAssociates = [newAssociate, ...associates];
    }
    setAssociates(updatedAssociates);
    mockStorage.set('associates', updatedAssociates);

    // 2. Lógica de Vínculo de Veículo (Apenas se informado)
    if (formData.linkedPlate && formData.linkedPlate.length >= 7) {
        const vehicles: Vehicle[] = mockStorage.get('vehicles') || [];
        const cleanPlate = formData.linkedPlate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        
        const existingVehicleIndex = vehicles.findIndex(v => v.plate.replace(/[^A-Z0-9]/g, '') === cleanPlate);

        if (existingVehicleIndex >= 0) {
            // Veículo existe: Atualiza o proprietário
            vehicles[existingVehicleIndex].associateId = newId;
        } else {
            // Veículo não existe: Cria novo veículo vinculado
            const newVehicle: Vehicle = {
                id: Math.random().toString(36).substr(2, 9),
                createdAt: new Date().toISOString(),
                plate: cleanPlate,
                associateId: newId,
                status: 'Ativo',
                km: 0,
                brand: '', model: 'A DEFINIR', version: '', yearFab: '', yearModel: '', color: '', fuel: '', type: ''
            };
            vehicles.unshift(newVehicle);
        }
        mockStorage.set('vehicles', vehicles);
    }

    setIsSubmitting(false);
    setIsModalOpen(false);
  };

  const filteredAssociates = associates.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.document.includes(searchTerm)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800">Base de Associados</h2>
          <p className="text-sm text-slate-500 font-medium">Gestão de clientes e proprietários de veículos.</p>
        </div>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-blue-700 shadow-xl shadow-blue-500/20 transition-all"
        >
          <Plus size={18} /> Novo Associado
        </button>
      </div>

      <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex-1 relative">
           <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
           <input 
             type="text" 
             placeholder="Buscar por nome, CPF ou CNPJ..." 
             className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-medium text-slate-600 focus:ring-4 focus:ring-blue-500/10 transition-all" 
             value={searchTerm} 
             onChange={e => setSearchTerm(e.target.value)} 
           />
        </div>
        <div className="flex bg-slate-100 p-1 rounded-2xl">
           <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><LayoutGrid size={20}/></button>
           <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}><List size={20}/></button>
        </div>
      </div>

      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
          {filteredAssociates.map(associate => (
            <div key={associate.id} className="bg-white p-6 rounded-[32px] border border-slate-200 hover:border-blue-300 transition-all shadow-sm group relative">
              <div className="flex justify-between items-start mb-4">
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg ${associate.type === 'PJ' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                    {associate.type === 'PJ' ? <Shield size={24}/> : <User size={24}/>}
                 </div>
                 <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest ${associate.type === 'PJ' ? 'bg-indigo-100 text-indigo-700' : 'bg-blue-100 text-blue-700'}`}>
                    {associate.type}
                 </span>
              </div>
              
              <h3 className="font-black text-slate-800 text-lg mb-1 truncate" title={associate.name}>{associate.name}</h3>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6">{associate.document}</p>
              
              <div className="space-y-2 pt-4 border-t border-slate-50">
                 {associate.email && (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Mail size={14} className="text-slate-300"/> {associate.email}
                    </div>
                 )}
                 {associate.phone && (
                    <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
                        <Phone size={14} className="text-slate-300"/> {associate.phone}
                    </div>
                 )}
              </div>

              <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                 <button onClick={() => handleOpenModal(associate)} className="p-2 text-slate-300 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"><Edit3 size={18}/></button>
                 <button onClick={() => handleDelete(associate.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"><Trash2 size={18}/></button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm animate-in fade-in duration-300">
           <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome / Razão Social</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Documento</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                   <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {filteredAssociates.map(a => (
                   <tr key={a.id} className="hover:bg-slate-50/50 group">
                      <td className="px-8 py-5">
                         <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${a.type === 'PJ' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                                {a.type === 'PJ' ? <Shield size={16}/> : <User size={16}/>}
                            </div>
                            <span className="font-bold text-slate-700">{a.name}</span>
                         </div>
                      </td>
                      <td className="px-8 py-5 text-xs font-bold text-slate-500">{a.document}</td>
                      <td className="px-8 py-5">
                         <div className="text-xs text-slate-500">
                            {a.email && <div className="flex items-center gap-1 mb-1"><Mail size={12}/> {a.email}</div>}
                            {a.phone && <div className="flex items-center gap-1"><Phone size={12}/> {a.phone}</div>}
                         </div>
                      </td>
                      <td className="px-8 py-5 text-right">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => handleOpenModal(a)} className="p-2 text-slate-400 hover:text-blue-600 rounded-lg"><Edit3 size={18}/></button>
                            <button onClick={() => handleDelete(a.id)} className="p-2 text-slate-400 hover:text-red-600 rounded-lg"><Trash2 size={18}/></button>
                         </div>
                      </td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {/* Modal de Cadastro */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in zoom-in duration-200">
             <div className="p-8 border-b border-slate-100 flex justify-between items-center">
                <div className="flex items-center gap-4">
                   <div className="bg-blue-600 p-3 rounded-2xl text-white shadow-lg shadow-blue-500/30"><UserCheck size={24}/></div>
                   <div>
                      <h3 className="text-xl font-black text-slate-800">{associateToEdit ? 'Editar Associado' : 'Cadastro de Associado'}</h3>
                      <p className="text-xs text-slate-500 font-medium mt-1">Preencha os dados e vincule veículos.</p>
                   </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400 hover:text-slate-600"><X size={24}/></button>
             </div>
             
             <form onSubmit={handleSave} className="p-8 space-y-6">
                <div className="grid grid-cols-2 gap-6">
                   <div className="col-span-2">
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Nome Completo / Razão Social *</label>
                      <input 
                        required 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                        value={formData.name} 
                        onChange={e => setFormData({...formData, name: e.target.value})}
                        placeholder="Ex: João da Silva"
                      />
                   </div>
                   
                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Tipo de Pessoa</label>
                      <div className="flex bg-slate-50 p-1 rounded-2xl border border-slate-100">
                         <button type="button" onClick={() => setFormData({...formData, type: 'PF'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PF' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Física (PF)</button>
                         <button type="button" onClick={() => setFormData({...formData, type: 'PJ'})} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all ${formData.type === 'PJ' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}>Jurídica (PJ)</button>
                      </div>
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Documento (CPF/CNPJ) *</label>
                      <input 
                        required 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all" 
                        value={formData.document} 
                        onChange={e => setFormData({...formData, document: e.target.value})}
                        placeholder={formData.type === 'PF' ? '000.000.000-00' : '00.000.000/0001-00'}
                      />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">E-mail</label>
                      <input 
                        type="email"
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={formData.email}
                        onChange={e => setFormData({...formData, email: e.target.value})}
                        placeholder="email@exemplo.com"
                      />
                   </div>

                   <div>
                      <label className="block text-[10px] font-black uppercase text-slate-400 mb-2 tracking-widest">Telefone / WhatsApp</label>
                      <input 
                        className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl font-bold text-slate-700 outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/20 transition-all"
                        value={formData.phone}
                        onChange={e => setFormData({...formData, phone: e.target.value})}
                        placeholder="(00) 90000-0000"
                      />
                   </div>

                   {!associateToEdit && (
                       <div className="col-span-2 mt-4 pt-6 border-t border-slate-100">
                          <label className="flex items-center gap-2 text-[10px] font-black uppercase text-blue-600 mb-3 tracking-widest">
                             <Car size={16}/> Vincular Veículo (Opcional)
                          </label>
                          <div className="bg-blue-50/50 p-6 rounded-3xl border border-blue-100">
                             <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                                Insira a placa do veículo principal deste associado. <br/>
                                <span className="font-bold text-blue-600">Se a placa não existir, o sistema criará o veículo automaticamente.</span>
                             </p>
                             <input 
                                className="w-full p-4 bg-white border border-blue-100 rounded-2xl font-black text-lg text-slate-800 outline-none focus:ring-4 focus:ring-blue-500/10 transition-all uppercase tracking-[0.2em] text-center placeholder:text-slate-300 placeholder:normal-case placeholder:tracking-normal placeholder:font-medium"
                                value={formData.linkedPlate}
                                onChange={e => setFormData({...formData, linkedPlate: e.target.value.toUpperCase()})}
                                placeholder="ABC1D23"
                                maxLength={7}
                             />
                          </div>
                       </div>
                   )}
                </div>

                <div className="pt-6 flex justify-end gap-3 border-t border-slate-50">
                   <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-4 text-slate-400 font-black uppercase text-[10px] hover:text-slate-600 tracking-widest">Cancelar</button>
                   <button type="submit" disabled={isSubmitting} className="px-10 py-4 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl shadow-blue-600/20 hover:bg-blue-700 transition-all flex items-center gap-2">
                      {isSubmitting ? <Loader2 className="animate-spin" size={16}/> : <><Save size={16}/> Salvar Associado</>}
                   </button>
                </div>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Associates;
