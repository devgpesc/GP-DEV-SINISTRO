
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

export interface Associate {
  id: string;
  name: string;
  document: string; // CPF/CNPJ
  type: 'PF' | 'PJ';
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  year: string;
  associateId: string;
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

export interface Item {
  id: string;
  description: string;
  category: string;
  code: string;
}

export interface QuoteItemValue {
  supplierId: string;
  price: number;
  deadline: number; // in days
  observations?: string;
  isSelected: boolean;
}

export interface Quotation {
  id: string;
  eventId: string;
  items: { itemId: string; description: string; values: QuoteItemValue[] }[];
  status: 'Open' | 'Closed' | 'Approved';
  approvalHash?: string;
}

export interface PurchaseOrder {
  id: string;
  eventId: string;
  supplierId: string;
  total: number;
  status: 'Pendente' | 'Aprovada' | 'Recusada' | 'Entregue';
  createdAt: string;
}

export interface Role {
  name: 'Admin' | 'Gerente' | 'Usuário';
  permissions: {
    module: string;
    action: 'view' | 'manage';
  }[];
}
