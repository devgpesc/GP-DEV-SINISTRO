
import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, TrendingDown, Clock, ShoppingCart, Trophy, Truck, DollarSign, ArrowRight, Package, Check } from 'lucide-react';
import { supabase } from '../services/supabaseClient';

interface MatrixProps {
  eventId?: string;
}

const MatrixTable: React.FC<MatrixProps> = ({ eventId }) => {
  const navigate = useNavigate();
  // Mock de Itens da Cotação (Poderia vir de uma tabela 'quotation_items')
  const [items] = useState([
    { id: 'i1', description: 'Alma De Aço Dianteira', partNumber: '52021-02190', quantity: 1, refPrice: 450.00 },
    { id: 'i2', description: 'Capô do Motor', partNumber: '53301-02300', quantity: 1, refPrice: 1200.00 },
  ]);

  const [suppliers] = useState([
    { id: 's1', name: 'TAURO Peças', rating: 4.8 },
    { id: 's2', name: 'REA Distribuidora', rating: 4.2 }
  ]);

  const [quotes, setQuotes] = useState<any>({});
  const [generatedOCs, setGeneratedOCs] = useState<any[] | null>(null);

  const handleConfirmEmission = async () => {
    if (!generatedOCs) return;

    const newOrders = generatedOCs.map((oc, index) => ({
      code: `OC-AUTO-${Date.now()}-${index}`,
      eventId: eventId || 'EVT-GENERIC',
      supplierId: oc.supplierId,
      total: oc.total,
      status: 'Gerada',
      createdAt: new Date().toISOString()
    }));

    const { error } = await supabase.from('purchase_orders').insert(newOrders);
    
    if (!error) {
        navigate('/compras');
    } else {
        alert('Erro ao emitir OCs: ' + error.message);
    }
  };

  // Simples visualização para não quebrar a UI
  return (
    <div className="space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
         <p className="text-slate-500 mb-4">Selecione os itens para gerar OCs</p>
         <button onClick={() => setGeneratedOCs([{supplierId: 's1', supplierName: 'TAURO', total: 1650, items: items}])} className="bg-blue-600 text-white px-6 py-2 rounded-xl">Simular Seleção</button>
      </div>
      
      {generatedOCs && (
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm text-center">
             <h3 className="font-bold text-slate-800 mb-4">Ordens Preparadas</h3>
             <button onClick={handleConfirmEmission} className="bg-green-600 text-white px-8 py-3 rounded-2xl font-black">Emitir OCs Reais</button>
          </div>
      )}
    </div>
  );
};

export default MatrixTable;
