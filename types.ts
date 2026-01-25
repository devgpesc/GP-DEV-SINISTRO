
export enum EventStatus {
  WAITING = 'Aguardando',
  QUOTING = 'Em Cotação',
  APPROVED = 'Aprovado',
  COMPLETED = 'Concluído'
}

export enum EventType {
  COLLISION = 'Colisão',
  THEFT = 'Furto',
  ROBBERY = 'Roubo',
  PERIPHERAL = 'Periférico'
}

export enum Priority {
  LOW = 'Baixa',
  MEDIUM = 'Média',
  HIGH = 'Alta',
  URGENT = 'Urgente'
}

export interface Category {
  id: string;
  name: string;
  color: string;
  description?: string;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  type: 'Peça' | 'Serviço';
  unit: string;
  description?: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  rating: number;
  segment: 'Peças' | 'Serviços' | 'Ambos';
  whatsapp: string;
  status: 'Ativo' | 'Inativo' | 'Bloqueado';
  blockedReason?: string;
  city: string;
  email?: string;
  createdAt: string;
  ratingHistory?: Array<{ date: string; score: number; comment?: string }>;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  eventId: string;
  supplierId: string;
  items: Array<{ catalogId: string; name: string; quantity: number; price: number }>;
  total: number;
  status: 'Gerada' | 'Enviada' | 'Aprovada' | 'Recebida' | 'Cancelada';
  createdAt: string;
  approvedAt?: string;
}

export interface Delivery {
  id: string;
  poId: string;
  status: 'Conforme' | 'Divergente';
  divergenceType?: 'Falta' | 'Dano' | 'Erro';
  notes: string;
  receivedAt: string;
}

export interface QuoteCell {
  price: number;
  selected: boolean;
  deadline?: number;
}

export interface QuoteItem {
  id: string;
  catalogId: string;
  name: string;
  quantity: number;
  prices: Record<string, QuoteCell>; // supplierId -> cell
}

export interface Quotation {
  id: string;
  protocol: string;
  eventId: string;
  items: QuoteItem[];
  suppliers: string[];
  status: 'Aberta' | 'Fechada' | 'Cancelada';
  sendMode: 'auto' | 'manual';
  createdAt: string;
}

export interface EventHistoryEntry {
  id: string;
  fromStatus: EventStatus;
  toStatus: EventStatus;
  comment: string;
  user: string;
  timestamp: string;
}

export interface Event {
  id: string;
  protocol: string;
  type: EventType;
  priority: Priority;
  status: EventStatus;
  category: string;
  vehicleId: string;
  associateId: string;
  createdAt: string;
  createdBy: string;
  description: string;
  attachments: any[];
  history: EventHistoryEntry[];
}

export interface Vehicle {
  id: string;
  plate: string;
  renavam?: string;
  chassi?: string;
  model: string;
  brand: string;
  year: string;
  associateId: string;
  createdAt: string;
}

export interface AppSettings {
  companyName: string;
  cnpj: string;
  address: string;
  email: string;
  phone: string;
  currency: string;
  autoApprovalLimit: number;
}
