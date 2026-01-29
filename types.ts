
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
  contactName?: string;
  createdAt: string;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  eventId: string;
  supplierId: string;
  items: Array<{ 
    catalogId: string; // Link com Catálogo
    name: string; 
    quantity: number; 
    price: number;
    catalog_item_id?: string; // Novo
  }>;
  total: number;
  status: 'Gerada' | 'Enviada' | 'Aprovada' | 'Recebida' | 'Cancelada';
  createdAt: string;
  approvedAt?: string;
}

// --- NOVOS TIPOS PARA MATRIZ INTELIGENTE ---

export interface Quotation {
  id: string;
  code: string;
  eventId?: string;
  eventRef?: string;
  status: 'Em Aberto' | 'Análise' | 'Aprovada' | 'Finalizada' | 'Cancelada';
  created_at: string;
  deadline?: string;
}

export interface QuotationItem {
  id: string;
  quotation_id: string;
  name: string;
  quantity: number;
  unit: string;
  category?: string;
  target_price?: number;
  catalog_item_id?: string; // Link com Catálogo
  status: 'Pendente' | 'Cotado' | 'Comprado';
}

export interface SupplierPrice {
  id: string;
  quotation_item_id: string;
  supplier_id: string;
  price: number;
  obs?: string;
  availability: boolean;
  is_winner?: boolean;
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

export interface SaasTenant {
  id: string;
  name: string;
  document: string;
  plan_id: string;
  status: 'active' | 'blocked' | 'suspended';
  created_at: string;
  owner_id?: string;
  saas_plans?: SaasPlan;
}

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  max_users: number;
  max_events: number;
  features: any;
}

export interface Associate {
  id: string;
  name: string;
  document: string;
  type: 'PF' | 'PJ';
}

export interface Vehicle {
  id: string;
  plate: string;
  model: string;
  brand: string;
  associate_id?: string;
  status: string;
  year_fab?: string;
  year_model?: string;
  km?: number;
  color?: string;
  renavam?: string;
  chassi?: string;
  type?: string;
  fuel?: string;
  version?: string;
  uf?: string;
  city?: string;
  notes?: string;
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
  description: string;
  createdAt: string;
  attachments: any[];
  history: any[];
}

export interface Delivery {
  id: string;
  po: string;
  supplier: string;
  items: number;
  date: string;
  event: string;
  status?: string;
}

// --- NOVOS TIPOS AUDITORIA E CONVITES ---

export interface AuditLog {
  id: string;
  action: string;
  entity: string;
  entity_id?: string;
  details?: any;
  user_id: string;
  created_at: string;
  user_email?: string;
  profiles?: { full_name: string; email: string };
}

export interface Invitation {
  id: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'accepted';
  created_by: string;
  created_at: string;
}

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'groq';
export type LLMModel = string;