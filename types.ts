
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
  availability: boolean;
  is_winner: boolean;
  obs?: string;
}

// Matriz de Dados (Frontend Helper)
export interface MatrixData {
  item: QuotationItem;
  prices: Record<string, SupplierPrice>; // Chave é supplier_id
  bestPrice: number;
  bestSupplierId: string;
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
  history: any[];
}

export interface Vehicle {
  id: string;
  created_at?: string;
  plate: string;
  associate_id: string;
  km: number;
  status: 'Ativo' | 'Inativo' | 'Manutenção';
  notes?: string;
  brand: string;
  model: string;
  version?: string;
  year_fab: string;
  year_model: string;
  color: string;
  fuel: string;
  type: string;
  chassi?: string;
  renavam?: string;
  uf?: string;
  city?: string;
}

export interface Associate {
  id: string;
  name: string;
  document: string;
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  createdAt: string;
}

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  max_users: number;
  max_events: number;
  features: any;
}

export interface SaasTenant {
  id: string;
  name: string;
  document: string;
  plan_id: string;
  status: 'active' | 'suspended' | 'blocked';
  created_at: string;
  saas_plans?: SaasPlan;
}

export interface CatalogItem {
  id: string;
  code: string;
  name: string;
  category: string;
  type: 'Peça' | 'Serviço';
  unit: string;
  description?: string;
  created_at?: string;
}

export interface Delivery {
  id: string;
  po: string;
  supplier: string;
  items: number;
  date: string;
  event: string;
  status?: 'Pendente' | 'Conforme' | 'Divergente';
  created_at?: string;
}

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'groq';

export type LLMModel = 
  | 'gemini-3-flash-preview' 
  | 'gemini-3-pro-preview'
  | string;
