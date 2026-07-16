
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

// --- SAAS TYPES ---

export interface OrganizationMember {
  id: string;
  tenant_id: string;
  user_id: string;
  role: 'owner' | 'admin' | 'member' | 'observer';
  created_at: string;
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
  
  // Billing Fields (Novos)
  subscription_status?: 'trial' | 'active' | 'past_due' | 'canceled' | 'incomplete';
  subscription_id?: string;
  trial_ends_at?: string;
  billing_cycle?: 'monthly' | 'yearly';
  current_period_end?: string;
}

export interface SaasPlan {
  id: string;
  name: string;
  price: number;
  max_users: number;
  max_events: number;
  features: {
    ai_analysis?: boolean;
    advanced_reports?: boolean;
    financial_module?: boolean;
    multi_branch?: boolean;
    api_access?: boolean;
    [key: string]: boolean | undefined;
  };
}

// --- BUSINESS ENTITIES ---

export interface Supplier {
  id: string;
  tenant_id?: string;
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
  tenant_id?: string;
  code: string;
  eventId: string;
  supplierId: string;
  items: Array<{ 
    catalogId: string;
    name: string; 
    quantity: number; 
    price: number;
    catalog_item_id?: string;
  }>;
  total: number;
  status: 'Gerada' | 'Enviada' | 'Aprovada' | 'Recebida' | 'Cancelada';
  createdAt: string;
  approvedAt?: string;
}

export interface Quotation {
  id: string;
  tenant_id?: string;
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
  item_type?: 'Peça' | 'Serviço';
  target_price?: number;
  catalog_item_id?: string;
  status: 'Pendente' | 'Cotado' | 'Comprado';
}

export interface SupplierPrice {
  id: string;
  quotation_item_id: string;
  supplier_id: string;
  price: number;
  obs?: string;
  availability: boolean;
  delivery_days?: number | null;
  is_winner?: boolean;
}

export interface PurchaseSelection {
  id: string;
  quotation_id: string;
  quotation_item_id: string;
  supplier_id: string;
  selected_price: number;
  quantity: number;
  justification?: string;
  status: 'Selecionado' | 'Processado' | 'Cancelado';
  selected_by?: string;
  selected_at: string;
}

export interface CatalogItem {
  id: string;
  tenant_id?: string;
  code: string;
  name: string;
  category: string;
  type: 'Peça' | 'Serviço';
  unit: string;
  description?: string;
}

export interface Associate {
  id: string;
  tenant_id?: string;
  name: string;
  document: string;
  type: 'PF' | 'PJ';
}

export interface Vehicle {
  id: string;
  tenant_id?: string;
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
  tenant_id?: string;
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
  tenant_id?: string;
  po: string;
  supplier: string;
  items: number;
  date: string;
  event: string;
  status?: string;
}

export interface AuditLog {
  id: string;
  tenant_id?: string;
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
  tenant_id?: string;
  email: string;
  name: string;
  role: string;
  status: 'pending' | 'accepted';
  created_by: string;
  created_at: string;
}

export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'groq';
export type LLMModel = string;
