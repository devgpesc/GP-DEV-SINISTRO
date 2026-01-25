
import React, { useState, useEffect } from 'react';
import { 
  Settings as SettingsIcon, Building, Users, Lock, 
  Bell, Palette, Globe, Save, CheckCircle, Database,
  MessageSquare, Target, Mail, ShieldAlert, Key, 
  CreditCard, Layout, Zap, UserPlus, MoreVertical, MessageCircle,
  Tag, Plus, Trash2, Edit
} from 'lucide-react';
import { mockStorage } from '../services/supabaseClient';
import { Category } from '../types';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'empresa' | 'usuarios' | 'sistema' | 'templates' | 'metas' | 'categorias'>('empresa');
  const [saved, setSaved] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCatName, setNewCatName] = useState('');

  useEffect(() => {
    const savedCats = mockStorage.get('app_categories') || [
      { id: '1', name: 'Funilaria Pesada', color: 'red' },
      { id: '2', name: 'Funilaria Leve', color: 'orange' },
      { id: '3', name: 'Mecânica', color: 'blue' },
      { id: '4', name: 'Elétrica', color: 'yellow' },
      { id: '5', name: 'Periféricos / Vidros', color: 'cyan' },
    ];
    setCategories(savedCats);
  }, []);

  const handleAddCategory = () => {
    if (!newCatName.trim()) return;
    const newCat: Category = {
      id: Math.random().toString(36).substr(2, 9),
      name: newCatName.trim(),
      color: 'slate'
    };
    const updated = [...categories, newCat];
    setCategories(updated);
    mockStorage.set('app_categories', updated);
    setNewCatName('');
  };

  const handleRemoveCategory = (id: string) => {
    const updated = categories.filter(c => c.id !== id);
    setCategories(updated);
    mockStorage.set('app_categories', updated);
  };

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const NavButton = ({ tab, icon: Icon, label }: { tab: any, icon: any, label: string }) => (
    <button 
      onClick={() => setActiveTab(tab)}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab ? 'bg-white border border-slate-200 shadow-sm text-blue-600 font-bold' : 'text-slate-500 hover:bg-slate-200/50'}`}
    >
      <Icon size={18}/> {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-4">
           <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl shadow-inner"><SettingsIcon size={32}/></div>
           <div>
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Painel de Governança</h2>
              <p className="text-sm text-slate-500 font-medium">Controle granular do ecossistema AutoClaims Pro.</p>
           </div>
        </div>
        <button 
          onClick={handleSave}
          className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20 uppercase text-xs tracking-widest"
        >
          {saved ? <CheckCircle size={18}/> : <Save size={18} />}
          {saved ? 'Alterações Salvas' : 'Salvar Alterações'}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-8">
        <div className="w-full lg:w-64 space-y-1.5 h-fit sticky top-6">
          <NavButton tab="empresa" icon={Building} label="Dados da Empresa" />
          <NavButton tab="usuarios" icon={Users} label="Usuários & Roles" />
          <NavButton tab="categorias" icon={Tag} label="Categorias Padronizadas" />
          <NavButton tab="sistema" icon={Database} label="Regras & Auditoria" />
          <NavButton tab="templates" icon={MessageSquare} label="Mensagens" />
          <NavButton tab="metas" icon={Target} label="Metas Financeiras" />
          <hr className="my-4 border-slate-200" />
          <NavButton tab="security" icon={Lock} label="Segurança" />
        </div>

        <div className="flex-1 bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm min-h-[600px]">
          {activeTab === 'empresa' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 mb-2">
                 <Building className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Perfil da Organização</h3>
               </div>
               <div className="grid grid-cols-2 gap-6">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Razão Social / Nome Fantasia</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" defaultValue="AutoClaims Pro Insurance Services LTDA" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">CNPJ Principal</label>
                    <input className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700" defaultValue="12.345.678/0001-90" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Unidade Federativa</label>
                    <select className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl outline-none font-bold text-slate-700">
                      <option>São Paulo - SP</option>
                      <option>Rio de Janeiro - RJ</option>
                      <option>Paraná - PR</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-[10px] font-black uppercase text-slate-400 mb-2">Endereço da Matriz</label>
                    <textarea className="w-full p-4 bg-slate-50 border border-slate-100 rounded-2xl h-24 outline-none font-bold text-slate-700" defaultValue="Av. Paulista, 1000, 15º Andar - São Paulo, SP, 01310-100" />
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'categorias' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Tag className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Categorização para Business Intelligence</h3>
               </div>
               
               <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  <p className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Adicionar Nova Categoria</p>
                  <div className="flex gap-4">
                     <input 
                        type="text" 
                        placeholder="Ex: Suspensão, Lanterna, Motor..."
                        className="flex-1 p-4 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-slate-700"
                        value={newCatName}
                        onChange={e => setNewCatName(e.target.value)}
                     />
                     <button 
                        onClick={handleAddCategory}
                        className="bg-blue-600 text-white px-8 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center gap-2 shadow-lg shadow-blue-500/20"
                     >
                        <Plus size={18}/> Adicionar
                     </button>
                  </div>
               </div>

               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {categories.map(cat => (
                    <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-100 rounded-2xl shadow-sm group hover:border-blue-200 transition-all">
                       <div className="flex items-center gap-3">
                          <div className={`w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/40`}></div>
                          <p className="font-black text-slate-700 text-sm tracking-tight">{cat.name}</p>
                       </div>
                       <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button className="p-2 text-slate-400 hover:text-blue-600"><Edit size={16}/></button>
                          <button onClick={() => handleRemoveCategory(cat.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 size={16}/></button>
                       </div>
                    </div>
                  ))}
               </div>

               <div className="p-6 bg-blue-50 border border-blue-100 rounded-3xl">
                  <p className="text-xs text-blue-700 font-medium leading-relaxed italic">
                    "A padronização de categorias é essencial para a análise visionária da IA. Categorias bem definidas permitem que o sistema identifique custos anormais e sugira parcerias estratégicas baseadas no volume real de cada setor."
                  </p>
               </div>
            </div>
          )}

          {activeTab === 'usuarios' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex justify-between items-center border-b border-slate-100 pb-4">
                  <h3 className="text-lg font-black text-slate-800 flex items-center gap-2"><Users size={20}/> Gestão de Colaboradores</h3>
                  <button className="bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-black uppercase flex items-center gap-2 hover:bg-blue-100 transition-all tracking-widest">
                    <UserPlus size={16}/> Convidar
                  </button>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { name: 'Admin Master', role: 'Administrador Senior', status: 'Ativo', color: 'blue' },
                    { name: 'João Comprador', role: 'Gestor de Compras', status: 'Ativo', color: 'indigo' },
                    { name: 'Maria Sinistros', role: 'Analista de Sinistros', status: 'Ativo', color: 'slate' },
                  ].map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-5 bg-slate-50/50 border border-slate-100 rounded-3xl hover:bg-white hover:shadow-md transition-all cursor-pointer group">
                       <div className="flex items-center gap-4">
                          <div className={`w-12 h-12 bg-${u.color}-100 text-${u.color}-600 rounded-2xl flex items-center justify-center font-black text-lg`}>{u.name.charAt(0)}</div>
                          <div>
                            <p className="font-black text-slate-800">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{u.role}</p>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                         <span className="text-[10px] font-black text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-100 uppercase tracking-widest">{u.status}</span>
                         <button className="p-2 text-slate-300 group-hover:text-slate-600 transition-colors"><MoreVertical size={20}/></button>
                       </div>
                    </div>
                  ))}
               </div>
            </div>
          )}

          {activeTab === 'sistema' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <ShieldAlert className="text-indigo-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Governança & Políticas Financeiras</h3>
               </div>
               <div className="space-y-6">
                  <div className="flex items-center justify-between p-8 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100 rounded-[32px]">
                     <div className="flex-1">
                        <p className="font-black text-blue-900 text-lg">Alçada de Aprovação Automática</p>
                        <p className="text-xs text-blue-700 font-medium leading-relaxed max-w-md">Defina o teto máximo onde o sistema aprova a OC automaticamente com base na Matriz Comparativa (menor preço).</p>
                     </div>
                     <div className="flex items-center gap-4">
                        <span className="text-sm font-black text-blue-800 tracking-tighter">R$</span>
                        <input className="w-40 p-4 bg-white border-2 border-blue-200 rounded-2xl font-black text-blue-900 text-center text-xl shadow-inner focus:border-blue-500 outline-none" defaultValue="5.000,00" />
                     </div>
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                     <div className="p-8 bg-slate-50/80 border border-slate-100 rounded-[32px]">
                        <div className="flex items-center gap-2 mb-6 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                          <Bell size={14}/> Notificações Críticas
                        </div>
                        <div className="space-y-4">
                           {[
                             { label: 'Novas Cotações Recebidas', checked: true },
                             { label: 'OCs Pendentes de Assinatura', checked: true },
                             { label: 'Atrasos de SLA de Cotação', checked: false },
                             { label: 'Divergências de Entrega', checked: true },
                           ].map((item, i) => (
                             <label key={i} className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
                                <div className="relative inline-flex items-center">
                                   <input type="checkbox" defaultChecked={item.checked} className="w-5 h-5 rounded-lg border-2 border-slate-200 text-blue-600 focus:ring-blue-500" />
                                </div>
                                {item.label}
                             </label>
                           ))}
                        </div>
                     </div>
                     <div className="p-8 bg-slate-50/80 border border-slate-100 rounded-[32px]">
                        <div className="flex items-center gap-2 mb-6 text-slate-400 font-black uppercase text-[10px] tracking-widest">
                          <Zap size={14}/> Auditoria Avançada
                        </div>
                        <div className="space-y-4">
                           {[
                             { label: 'Log Completo de Acessos', checked: true },
                             { label: 'Rastreio de Visualização de Preços', checked: true },
                             { label: 'Justificativa para Desvio de Menor Preço', checked: true },
                             { label: 'Exigir 2FA para Aprovar OCs > R$ 10k', checked: false },
                           ].map((item, i) => (
                             <label key={i} className="flex items-center gap-4 text-xs font-bold text-slate-700 cursor-pointer hover:bg-white p-2 rounded-xl transition-all">
                                <input type="checkbox" defaultChecked={item.checked} className="w-5 h-5 rounded-lg border-2 border-slate-200 text-blue-600 focus:ring-blue-500" />
                                {item.label}
                             </label>
                           ))}
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}

          {activeTab === 'metas' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <Target className="text-green-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Metas & Planejamento Financeiro</h3>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                     <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Savings Esperado Mensal</p>
                     <div className="relative">
                        <input className="w-full p-6 bg-slate-50 border border-slate-100 rounded-[32px] text-2xl font-black text-slate-800 pl-14" defaultValue="15" />
                        <span className="absolute left-6 top-1/2 -translate-y-1/2 text-2xl font-black text-slate-300">%</span>
                     </div>
                     <p className="text-[11px] text-slate-500 leading-relaxed italic">Esta meta será utilizada nos dashboards para medir a eficiência de negociação frente à média de mercado.</p>
                  </div>
                  <div className="bg-green-50 p-8 rounded-[32px] border border-green-100 flex flex-col justify-between">
                     <h4 className="font-black text-green-900 mb-2">Impacto Estratégico</h4>
                     <p className="text-xs text-green-700 leading-relaxed font-medium">Metas bem definidas permitem que a IA do AutoClaims Pro identifique desvios de performance em tempo real, alertando o gestor sobre oportunidades de renegociação com fornecedores Tier-1.</p>
                     <div className="mt-4 flex gap-2">
                        <div className="h-2 w-full bg-green-200 rounded-full overflow-hidden">
                           <div className="h-full bg-green-500 w-3/4"></div>
                        </div>
                     </div>
                  </div>
               </div>
            </div>
          )}
          
          {activeTab === 'templates' && (
            <div className="space-y-8 animate-in fade-in duration-300">
               <div className="flex items-center gap-2 border-b border-slate-100 pb-4">
                 <MessageSquare className="text-blue-500" size={20}/>
                 <h3 className="text-lg font-black text-slate-800">Templates de Comunicação</h3>
               </div>
               <div className="space-y-4">
                  {[
                    { title: 'RFQ - Envio de Cotação (WhatsApp)', desc: 'Olá {{fornecedor}}, solicitamos cotação para o evento {{protocolo}}...', icon: MessageCircle },
                    { title: 'OC - Confirmação de Pedido (E-mail)', desc: 'Prezado, anexamos a Ordem de Compra {{oc_codigo}} referente...', icon: Mail },
                    { title: 'Entrega - Notificação de Recebimento', desc: 'Confirmamos o recebimento dos itens da OC {{oc_codigo}} em...', icon: Zap },
                  ].map((t, i) => (
                    <div key={i} className="p-6 bg-slate-50 border border-slate-100 rounded-3xl group hover:border-blue-200 transition-all cursor-pointer">
                       <div className="flex justify-between items-start mb-2">
                          <div className="flex items-center gap-3">
                             <div className="p-2 bg-white rounded-xl shadow-sm text-slate-400 group-hover:text-blue-500 transition-colors"><t.icon size={18}/></div>
                             <p className="font-black text-slate-800 text-sm tracking-tight">{t.title}</p>
                          </div>
                          <button className="text-[10px] font-black uppercase text-blue-600 hover:underline">Configurar</button>
                       </div>
                       <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed italic">"{t.desc}"</p>
                    </div>
                  ))}
               </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
