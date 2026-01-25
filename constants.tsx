
import { EventStatus, EventType, Priority } from './types';

export const COLORS = {
  primary: '#0f172a',
  secondary: '#334155',
  accent: '#3b82f6',
  success: '#22c55e',
  danger: '#ef4444',
  warning: '#f59e0b',
};

export const MOCK_EVENTS = [
  {
    id: '1',
    protocol: 'EVT-2024-0001',
    type: EventType.COLLISION,
    priority: Priority.HIGH,
    status: EventStatus.QUOTING,
    category: 'Funilaria Pesada',
    vehicleId: 'v1',
    associateId: 'a1',
    createdAt: '2024-05-10T14:30:00Z',
    createdBy: 'João Silva',
    description: 'Batida frontal em cruzamento.'
  },
  {
    id: '2',
    protocol: 'EVT-2024-0002',
    type: EventType.PERIPHERAL,
    priority: Priority.LOW,
    status: EventStatus.WAITING,
    category: 'Vidros',
    vehicleId: 'v2',
    associateId: 'a2',
    createdAt: '2024-05-11T09:15:00Z',
    createdBy: 'Maria Santos',
    description: 'Troca de parabrisa trincado.'
  }
];

export const MOCK_SUPPLIERS = [
  { id: 's1', name: 'Peças Express', cnpj: '12.345.678/0001-90', rating: 4.5, segment: 'Peças', whatsapp: '5511999999999', status: 'Ativo' },
  { id: 's2', name: 'Auto Centro Silva', cnpj: '98.765.432/0001-10', rating: 4.8, segment: 'Ambos', whatsapp: '5511888888888', status: 'Ativo' },
  { id: 's3', name: 'Distribuidora Norte', cnpj: '11.222.333/0001-44', rating: 3.9, segment: 'Peças', whatsapp: '5511777777777', status: 'Ativo' },
];

export const MOCK_ASSOCIATES = [
  { id: 'a1', name: 'Carlos Alberto Pires', document: '123.456.789-00', type: 'PF' },
  { id: 'a2', name: 'Transportes Rápidos LTDA', document: '10.200.300/0001-50', type: 'PJ' },
];

export const MOCK_VEHICLES = [
  { id: 'v1', plate: 'ABC-1234', model: 'Corolla', brand: 'Toyota', year: '2022', associateId: 'a1' },
  { id: 'v2', plate: 'XYZ-9876', model: 'Sprinter', brand: 'Mercedes-Benz', year: '2021', associateId: 'a2' },
];
