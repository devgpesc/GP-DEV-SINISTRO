
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Plus, Search, MoreVertical, Eye, X, AlertCircle, 
  Upload, FileText, Image as ImageIcon, Trash2, Tag, 
  ShieldAlert, Hash, Zap, Edit3, Clock, Paperclip, History,
  ChevronRight, Calendar, User, MapPin, Car, Mail, Phone, ExternalLink
} from 'lucide-react';
import { MOCK_EVENTS, MOCK_VEHICLES, MOCK_ASSOCIATES } from '../constants';
import { EventStatus, EventType, Priority, Event } from '../types';
import StatusChangeModal from '../components/StatusChangeModal';
import { mockStorage } from '../services/supabaseClient';

const StatusBadge = ({ status }: { status: EventStatus }) => {
  const styles: any = {
    [EventStatus.WAITING]: 'bg-slate-100 text-slate-600 border-slate-200',
    [EventStatus.QUOTING]: 'bg-blue-50 text-blue-600 border-blue-100',
    [EventStatus.APPROVED]: 'bg-green-50 text-green-600 border-green-100',
    [EventStatus.COMPLETED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  };
  return (
    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${styles[status]}`}>
      {status}
    </span>
  );
};

const PriorityBadge = ({ priority }: { priority: Priority }) => {
  const styles: any = {
    [Priority.LOW]: 'bg-slate-100 text-slate-500',
    [Priority.MEDIUM]: 'bg-blue-50 text-blue-500',
    [Priority.HIGH]: 'bg-amber-100 text-amber-600',
    [Priority.URGENT]: 'bg-red-100 text-red-600 animate-pulse',
  };
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-2 h-2 rounded-full ${priority === Priority.URGENT ? 'bg-red-500' : priority === Priority.HIGH ? 'bg-amber-500' : 'bg-slate-400'}`}></div>
      <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wide">{priority}</span>
    </div>
  );
};

const Events: React.FC = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const PREDEFINED_CATEGORIES = ['Mecânica', 'Elétrica', 'Funilaria', 'Seguro', 'Outros'];

  const [formData, setFormData] = useState({
    protocolMode: 'auto' as 'auto' | 'manual',
    manualProtocol: '',
    type: EventType.COLLISION,
    priority: Priority.MEDIUM,
    category: '',
    vehicleId: 'v1',
    associateId: 'a1',
    description: '',
    attachments: [] as any[]
  });

  useEffect(() => {
    const savedEvents = mockStorage.get('events') || MOCK_EVENTS.map(e => ({ ...e, history: [], attachments: [] }));
    setEvents(savedEvents);
  }, []);

  const nextAutoProtocol = useMemo(() => {
    return `EVT-2024-${String(events.length + 1).padStart(4, '0')}`;
  }, [events]);

  const handleEdit = (evt: Event) => {
    setEventToEdit(evt);
    setFormData({
      protocolMode: evt.protocol.startsWith('EVT') ? 'auto' : 'manual',
      manualProtocol: evt.protocol,
      type: evt.type,
      priority: evt.priority,
      category: evt.category,
      vehicleId: evt.vehicleId,
      associateId: evt.associateId,
      description: evt.description,
      attachments: evt.attachments || []
    });
    setIsModalOpen(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const protocol = formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol;

    const newEvent: Event = {
      id: eventToEdit ? eventToEdit.id : Math.random().toString(36).substr(2, 9),
      protocol: protocol,
      type: formData.type,
      priority: formData.priority,
      status: eventToEdit ? eventToEdit.status : EventStatus.WAITING,
      category: formData.category || 'Não categorizado',
      vehicleId: formData.vehicleId,
      associateId: formData.associateId,
      createdAt: eventToEdit ? eventToEdit.createdAt : new Date().toISOString(),
      createdBy: eventToEdit ? eventToEdit.createdBy : 'Admin Master',
      description: formData.description,
      attachments: formData.attachments,
      history: eventToEdit ? eventToEdit.history : [{
        id: 'h1',
        fromStatus: EventStatus.WAITING,
        toStatus: EventStatus.WAITING,
        comment: 'Sinistro registrado no sistema.',
        user: 'Admin Master',
        timestamp: new Date().toISOString()
      }]
    };

    let updated;
    if (eventToEdit) {
      updated = events.map(evt => evt.id === eventToEdit.id ? newEvent : evt);
    } else {
      updated = [newEvent, ...events];
    }
    
    setEvents(updated);
    mockStorage.set('events', updated);
    setIsModalOpen(false);
    setEventToEdit(null);
  };

  const filteredEvents = events.filter(e => {
    const associate = MOCK_ASSOCIATES.find(a => a.id === e.associateId);
    const vehicle = MOCK_VEHICLES.find(v => v.id === e.vehicleId);
    const lowSearch = searchTerm.toLowerCase();
    return (
      e.protocol.toLowerCase().includes(lowSearch) ||
      associate?.name.toLowerCase().includes(lowSearch) ||
      vehicle?.plate.toLowerCase().includes(lowSearch)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por Protocolo, Nome do Cliente ou Placa..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 rounded-2xl outline-none border border-slate-100 text-sm font-medium focus:ring-2 focus:ring-blue-500/20"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => { setEventToEdit(null); setIsModalOpen(true); }}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 hover:bg-blue-700 shadow-xl shadow-blue-600/20 whitespace-nowrap"
        >
          <Plus size={18} /> Novo Sinistro
        </button>
      </div>

      <div className="bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Protocolo / Cliente</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Placa / Veículo</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Prioridade</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredEvents.map(evt => {
               const associate = MOCK_ASSOCIATES.find(a => a.id === evt.associateId);
               const vehicle = MOCK_VEHICLES.find(v => v.id === evt.vehicleId);
               return (
                <tr key={evt.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-8 py-5">
                    <p className="font-black text-slate-800 leading-none mb-1">{evt.protocol}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">{associate?.name}</p>
                  </td>
                  <td className="px-8 py-5">
                    <p className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-lg inline-block text-[11px] border border-slate-200 mb-1">{vehicle?.plate}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase block">{vehicle?.model}</p>
                  </td>
                  <td className="px-8 py-5"><div className="flex justify-center"><PriorityBadge priority={evt.priority} /></div></td>
                  <td className="px-8 py-5 text-center"><StatusBadge status={evt.status} /></td>
                  <td className="px-8 py-5 text-right flex items-center justify-end gap-1">
                     <button onClick={() => setSelectedEvent(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Visualizar Detalhes"><Eye size={18}/></button>
                     <button onClick={() => handleEdit(evt)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Editar"><Edit3 size={18}/></button>
                     <button onClick={() => setEventToDelete(evt)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" title="Excluir"><Trash2 size={18}/></button>
                  </td>
                </tr>
               )
            })}
          </tbody>
        </table>
      </div>

      {/* Modal de Detalhes (Visualizar) */}
      {selectedEvent && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setSelectedEvent(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[40px] shadow-2xl flex flex-col max-h-[90vh] animate-in fade-in zoom-in duration-300 overflow-hidden">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <div className="flex items-center gap-5">
                  <div className="w-16 h-16 bg-blue-600 text-white rounded-[24px] flex items-center justify-center text-2xl font-black shadow-xl shadow-blue-600/20">
                    <ShieldAlert size={32} />
                  </div>
                  <div>
                    <h2 className="text-3xl font-black text-slate-800 tracking-tighter leading-none mb-1">{selectedEvent.protocol}</h2>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={selectedEvent.status} />
                      <PriorityBadge priority={selectedEvent.priority} />
                    </div>
                  </div>
               </div>
               <button onClick={() => setSelectedEvent(null)} className="p-3 text-slate-300 hover:text-slate-600 hover:bg-white rounded-full transition-all"><X size={32}/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-10 grid grid-cols-1 lg:grid-cols-3 gap-10">
               <div className="lg:col-span-2 space-y-10">
                  <section>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <FileText size={14}/> Detalhes do Sinistro
                    </h3>
                    <div className="bg-slate-50 p-8 rounded-[32px] border border-slate-100 grid grid-cols-2 gap-8">
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Tipo de Evento</p>
                          <p className="font-black text-slate-800">{selectedEvent.type}</p>
                       </div>
                       <div>
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Categoria</p>
                          <p className="font-black text-slate-800 text-blue-600">{selectedEvent.category}</p>
                       </div>
                       <div className="col-span-2">
                          <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Descrição / Observações</p>
                          <p className="text-sm font-medium text-slate-600 leading-relaxed bg-white p-4 rounded-2xl border border-slate-100">{selectedEvent.description || 'Nenhuma observação registrada.'}</p>
                       </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <Car size={14}/> Veículo e Associado
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       {/* Card Associado Detalhado */}
                       <div className="p-6 bg-white border border-slate-100 rounded-[28px] shadow-sm relative group hover:border-blue-200 transition-all flex flex-col justify-between h-full">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Associado Responsável</p>
                                <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl"><User size={18}/></div>
                            </div>
                            
                            {(() => {
                                const linkedAssociate = MOCK_ASSOCIATES.find(a => a.id === selectedEvent.associateId);
                                return (
                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-lg font-black text-slate-800 leading-tight">{linkedAssociate?.name || 'Não vinculado'}</p>
                                            <p className="text-xs font-medium text-slate-500 mt-1">{linkedAssociate?.document || '-'}</p>
                                        </div>
                                        <div className="space-y-2 pt-2 border-t border-slate-50">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400"><Mail size={14}/></div>
                                                <p className="text-xs font-bold text-slate-600">{(linkedAssociate as any)?.email || 'email@exemplo.com'}</p>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-slate-50 flex items-center justify-center text-slate-400"><Phone size={14}/></div>
                                                <p className="text-xs font-bold text-slate-600">{(linkedAssociate as any)?.phone || '(11) 99999-9999'}</p>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                          </div>
                          <Link to="/veiculos" className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                             Ver Cadastro Completo <ExternalLink size={14}/>
                          </Link>
                       </div>

                       {/* Card Veículo Detalhado */}
                       <div className="p-6 bg-white border border-slate-100 rounded-[28px] shadow-sm relative group hover:border-blue-200 transition-all flex flex-col justify-between h-full">
                          <div>
                            <div className="flex justify-between items-start mb-4">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Veículo do Evento</p>
                                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Car size={18}/></div>
                            </div>

                            {(() => {
                                const linkedVehicle = MOCK_VEHICLES.find(v => v.id === selectedEvent.vehicleId);
                                return (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="bg-slate-900 text-white px-3 py-1 rounded-lg font-black text-sm tracking-widest shadow-lg shadow-slate-200">
                                                {linkedVehicle?.plate || '---'}
                                            </div>
                                            <span className="text-[10px] font-black text-slate-400 uppercase bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                                {linkedVehicle?.year || 'N/A'}
                                            </span>
                                        </div>
                                        <div>
                                            <p className="text-lg font-black text-slate-800 leading-tight uppercase">{linkedVehicle?.model || 'Desconhecido'}</p>
                                            <p className="text-xs font-bold text-slate-400 uppercase mt-1 tracking-widest">{linkedVehicle?.brand || '-'}</p>
                                        </div>
                                        <div className="pt-2 border-t border-slate-50">
                                            <p className="text-[10px] text-slate-400 font-bold uppercase mb-1">Status Frota</p>
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                                                <span className="text-xs font-bold text-green-600">Ativo / Regular</span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                          </div>
                          <Link to="/veiculos" className="mt-6 flex items-center justify-center gap-2 w-full py-3 bg-slate-50 text-slate-600 rounded-xl text-[10px] font-black uppercase hover:bg-blue-50 hover:text-blue-600 transition-colors">
                             Ver Ficha Técnica <ExternalLink size={14}/>
                          </Link>
                       </div>
                    </div>
                  </section>

                  <section>
                    <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                       <ImageIcon size={14}/> Anexos e Evidências
                    </h3>
                    <div className="grid grid-cols-4 gap-4">
                       {selectedEvent.attachments && selectedEvent.attachments.length > 0 ? selectedEvent.attachments.map((at, i) => (
                         <div key={i} className="aspect-square bg-slate-100 rounded-2xl border border-slate-200 overflow-hidden group cursor-pointer relative shadow-sm">
                            <img src={at.data} className="w-full h-full object-cover transition-transform group-hover:scale-110" alt={at.name} />
                            <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <Paperclip className="text-white" size={24}/>
                            </div>
                         </div>
                       )) : (
                         <div className="col-span-4 p-8 border-2 border-dashed border-slate-100 rounded-[32px] text-center">
                            <ImageIcon className="mx-auto text-slate-200 mb-3" size={32}/>
                            <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Nenhum anexo enviado</p>
                         </div>
                       )}
                    </div>
                  </section>
               </div>

               <div className="bg-slate-50/50 rounded-[32px] border-l border-slate-100 p-8 space-y-8">
                  <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-2">
                     <History size={14}/> Timeline do Evento
                  </h3>
                  <div className="space-y-8 relative before:absolute before:left-[11px] before:top-2 before:bottom-0 before:w-px before:bg-slate-200">
                     {selectedEvent.history && selectedEvent.history.length > 0 ? selectedEvent.history.map((h, i) => (
                       <div key={i} className="relative pl-10">
                          <div className="absolute left-0 top-1 w-6 h-6 bg-white border-2 border-blue-600 rounded-full flex items-center justify-center z-10">
                             <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                          </div>
                          <div>
                             <div className="flex justify-between items-start mb-1">
                                <p className="text-[11px] font-black text-slate-800 uppercase tracking-tight">{h.toStatus}</p>
                                <span className="text-[9px] font-bold text-slate-400 uppercase">{new Date(h.timestamp).toLocaleDateString()}</span>
                             </div>
                             <p className="text-[11px] text-slate-500 font-medium leading-relaxed italic">"{h.comment}"</p>
                             <div className="flex items-center gap-2 mt-2 text-[9px] font-black text-blue-600 uppercase">
                                <User size={10}/> {h.user}
                             </div>
                          </div>
                       </div>
                     )) : (
                       <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest text-center py-10">Aguardando movimentação</p>
                     )}
                  </div>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Exclusão "Caixa Bonita" */}
      {eventToDelete && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setEventToDelete(null)}></div>
          <div className="relative bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-8 animate-in zoom-in duration-200 text-center">
            <div className="w-20 h-20 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={40} />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Excluir Sinistro?</h3>
            <p className="text-sm text-slate-500 font-medium mb-8 leading-relaxed">
              Você está prestes a remover o protocolo <span className="font-black text-slate-800">{eventToDelete.protocol}</span>. Esta ação não pode ser desfeita.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setEventToDelete(null)} className="py-3 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
              <button onClick={() => {
                const updated = events.filter(e => e.id !== eventToDelete.id);
                setEvents(updated);
                mockStorage.set('events', updated);
                setEventToDelete(null);
              }} className="py-3 bg-red-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Cadastro/Edição */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)}></div>
          <div className="relative bg-white w-full max-w-2xl rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-xl font-black text-slate-800 flex items-center gap-3">
                <div className="bg-blue-600 p-2.5 rounded-2xl text-white"><ShieldAlert size={24} /></div>
                {eventToEdit ? 'Editar Sinistro' : 'Registro de Sinistro'}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="p-2 text-slate-400"><X size={24}/></button>
            </div>
            <form onSubmit={handleSave} className="p-8 space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="col-span-2 p-5 bg-blue-50/50 rounded-3xl border border-blue-100 flex gap-4">
                  <div className="flex-1">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Modo</label>
                    <div className="flex bg-white p-1 rounded-xl">
                      <button type="button" onClick={() => setFormData({...formData, protocolMode: 'auto'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'auto' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Auto</button>
                      <button type="button" onClick={() => setFormData({...formData, protocolMode: 'manual'})} className={`flex-1 py-2 rounded-lg text-[10px] font-black uppercase ${formData.protocolMode === 'manual' ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>Manual</button>
                    </div>
                  </div>
                  <div className="flex-[2]">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Protocolo</label>
                    <input disabled={formData.protocolMode === 'auto'} className="w-full p-3 bg-white border border-slate-200 rounded-xl font-black outline-none" value={formData.protocolMode === 'auto' ? (eventToEdit ? eventToEdit.protocol : nextAutoProtocol) : formData.manualProtocol} onChange={e => setFormData({...formData, manualProtocol: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Tipo</label>
                  <select className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as any})}>
                    {Object.values(EventType).map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Categoria</label>
                  <select required className="w-full p-4 bg-slate-50 rounded-2xl border border-slate-100 font-bold" value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
                    <option value="">Selecione...</option>
                    {PREDEFINED_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Descrição</label>
                  <textarea className="w-full p-5 bg-slate-50 rounded-3xl border border-slate-100 h-28 outline-none font-medium resize-none" value={formData.description} onChange={e => setFormData({...formData, description: e.target.value})} />
                </div>
              </div>
              <div className="flex justify-end gap-3 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-8 py-3 text-slate-400 font-black uppercase text-[10px]">Cancelar</button>
                <button type="submit" className="px-12 py-4 bg-blue-600 text-white rounded-[20px] font-black text-xs uppercase tracking-widest shadow-xl shadow-blue-600/20">Salvar Alterações</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
