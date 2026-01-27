
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
  contactName?: string;
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

// --- VEÍCULOS (NOVA ESTRUTURA) ---
export interface Vehicle {
  // Campos de Sistema
  id: string;
  createdAt: string;
  
  // Campos Preenchidos pelo Usuário
  plate: string;          // Placa (Chave de busca)
  associateId: string;    // Proprietário
  km: number;             // KM Atual
  status: 'Ativo' | 'Inativo' | 'Manutenção';
  notes?: string;

  // Campos Automáticos (Via API / Read-only recommended)
  brand: string;          // Marca
  model: string;          // Modelo
  version?: string;       // Versão
  yearFab: string;        // Ano Fabricação
  yearModel: string;      // Ano Modelo
  color: string;          // Cor
  fuel: string;           // Combustível
  type: string;           // Tipo (Automóvel, Moto, etc)
  chassi?: string;        // Chassi
  renavam?: string;       // Renavam
  uf?: string;            // UF de registro
  city?: string;          // Município de registro
}

// --- ASSOCIADO ---
export interface Associate {
  id: string;
  name: string;
  document: string; // CPF ou CNPJ
  type: 'PF' | 'PJ';
  email?: string;
  phone?: string;
  createdAt: string;
}

// --- LLM & AI ---
export type LLMProvider = 'google' | 'openai' | 'anthropic' | 'groq';

export type LLMModel = 
  | 'gemini-3-flash-preview' 
  | 'gemini-3-pro-preview' 
  | 'gpt-4.1-mini' 
  | 'gpt-4.1' 
  | 'claude-3.5-sonnet' 
  | 'claude-3.5-haiku' 
  | 'llama-3.3-70b' 
  | 'mixtral-8x7b';

export interface AIConfig {
  provider: LLMProvider;
  model: LLMModel;
  temperature: number;
  maxTokens?: number;
}

export interface Event {
  id: string;
  protocol: string;
  type: EventType;
  priority: Priority;
  status: EventStatus;
  category: string;
  
  // Vínculos Obrigatórios (Banco de Dados e Regra de Negócio)
  vehicleId: string;
  associateId: string;
  
  createdAt: string;
  createdBy: string;
  description: string;
  attachments: any[];
  history: any[];
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
