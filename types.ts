
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

export interface EventHistoryEntry {
  id: string;
  fromStatus: EventStatus;
  toStatus: EventStatus;
  comment: string;
  user: string;
  timestamp: string;
}

export interface EventAttachment {
  id: string;
  name: string;
  url: string;
  type: string;
  size: number;
  uploadedAt: string;
  uploadedBy: string;
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
  attachments: EventAttachment[];
  history: EventHistoryEntry[];
}

export interface Vehicle {
  id: string;
  plate: string;
  renavam: string;
  chassi: string;
  model: string;
  brand: string;
  year: string;
  associateId: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  cnpj: string;
  rating: number;
  segment: 'Peças' | 'Serviços' | 'Ambos';
  whatsapp: string;
  status: 'Ativo' | 'Inativo' | 'Bloqueado';
}

export interface QuoteCell {
  price: number;
  selected: boolean;
  deadline?: number;
}

export interface Quotation {
  id: string;
  eventId: string;
  vehiclePlate: string;
  responsibleBuyer: string;
  workshop: string;
  items: { 
    id: string; 
    description: string; 
    quantity: number; 
    refPrice?: number;
    prices: Record<string, QuoteCell>;
  }[];
  createdAt: string;
}
