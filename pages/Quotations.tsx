
import React, { useState } from 'react';
import { 
  Plus, 
  Search, 
  ChevronRight, 
  ArrowLeft, 
  Send, 
  CheckCircle,
  FileText
} from 'lucide-react';
import { MOCK_SUPPLIERS } from '../constants';
import MatrixTable from '../components/MatrixTable';

const Quotations: React.FC = () => {
  const [step, setStep] = useState(1); // 1: List, 2: Matrix
  const [selections, setSelections] = useState<Record<string, string>>({});

  const mockItems = [
    { id: 'i1', description: 'Parachoque Dianteiro (Genuíno)', category: 'Peças' },
    { id: 'i2', description: 'Farol Lado Direito LED', category: 'Peças' },
    { id: 'i3', description: 'Serviço de Pintura e Alinhamento', category: 'Serviços' },
  ];

  const handleSelect = (itemId: string, supplierId: string) => {
    setSelections(prev => ({ ...prev, [itemId]: supplierId }));
  };

  if (step === 2) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <button onClick={() => setStep(1)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 text-slate-600 shadow-sm">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-xl font-bold text-slate-800">Cotação: EVT-2024-0001</h2>
            <p className="text-sm text-slate-500 font-medium">Fase 2: Análise da Matriz Comparativa</p>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <div className="xl:col-span-3">
             <MatrixTable 
               items={mockItems} 
               suppliers={MOCK_SUPPLIERS} 
               onSelect={handleSelect}
               selections={selections}
             />
          </div>
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
               <h4 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                 <CheckCircle size={18} className="text-blue-600" />
                 Resumo do Carrinho
               </h4>
               <div className="space-y-4">
                 {Object.entries(selections).map(([itemId, supplierId]) => {
                   const item = mockItems.find(i => i.id === itemId);
                   const supplier = MOCK_SUPPLIERS.find(s => s.id === supplierId);
                   return (
                     <div key={itemId} className="text-sm border-b border-slate-100 pb-2">
                       <p className="font-bold text-slate-700">{item?.description}</p>
                       <p className="text-xs text-blue-600 font-medium">{supplier?.name}</p>
                     </div>
                   );
                 })}
                 {Object.keys(selections).length === 0 && (
                   <p className="text-xs text-slate-400 italic">Nenhum item selecionado na matriz.</p>
                 )}
               </div>
               {Object.keys(selections).length > 0 && (
                 <button className="w-full mt-6 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all">
                   Finalizar Escolha
                 </button>
               )}
            </div>

            <div className="bg-blue-600 p-6 rounded-2xl shadow-lg shadow-blue-600/20 text-white">
               <h4 className="font-bold mb-2 flex items-center gap-2">
                 <Send size={18} />
                 Envio de OCs
               </h4>
               <p className="text-xs text-blue-100 mb-4">Ao finalizar, o sistema gerará automaticamente as Ordens de Compra e enviará por WhatsApp/E-mail conforme configurado.</p>
               <div className="space-y-2">
                 <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500" />
                    Enviar via WhatsApp
                 </label>
                 <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" defaultChecked className="rounded text-blue-600 focus:ring-blue-500" />
                    Enviar via E-mail
                 </label>
               </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="relative w-80">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar cotações..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm"
          />
        </div>
        <button className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">
          <Plus size={20} />
          Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:shadow-md transition-shadow group cursor-pointer" onClick={() => setStep(2)}>
            <div className="flex justify-between items-start mb-4">
              <div className="bg-blue-50 text-blue-600 p-2 rounded-lg">
                <FileText size={20} />
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${i === 1 ? 'bg-amber-100 text-amber-600' : 'bg-green-100 text-green-600'}`}>
                {i === 1 ? 'Em Aberto' : 'Aprovada'}
              </span>
            </div>
            <h3 className="font-bold text-slate-800 text-lg group-hover:text-blue-600 transition-colors">EVT-2024-000{i}</h3>
            <p className="text-sm text-slate-500 mb-4 font-medium">Corolla - ABC-1234</p>
            <div className="flex justify-between items-center pt-4 border-t border-slate-100">
               <div className="flex -space-x-2">
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center text-[10px] font-bold">FE</div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-slate-300 flex items-center justify-center text-[10px] font-bold">AS</div>
                  <div className="w-8 h-8 rounded-full border-2 border-white bg-blue-600 text-white flex items-center justify-center text-[10px] font-bold">+1</div>
               </div>
               <div className="flex items-center gap-1 text-blue-600 font-bold text-sm">
                 Analisar <ChevronRight size={16} />
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Quotations;
