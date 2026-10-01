export type InsumoCategory = 'banho_tosa' | 'cirurgia' | 'internacao' | 'geral';

export type UnitType = 
  | 'un' 
  | 'ml' 
  | 'l' 
  | 'g' 
  | 'kg' 
  | 'par' 
  | 'm' 
  | 'kwh' 
  | 'min' 
  | 'dose' 
  | 'diaria' 
  | 'hora';

export type PackageType =
  | 'caixa'
  | 'pacote'
  | 'frasco'
  | 'galao'
  | 'ampola'
  | 'bolsa'
  | 'rolo'
  | 'fardo'
  | 'kit'
  | 'unidade';

export interface Insumo {
  id: string;
  name: string;
  category: InsumoCategory;
  unit: UnitType; // Unidade de uso nos procedimentos
  costPerUnit: number; // Custo unitário em R$ (packagePrice ÷ packageSize quando comprado em embalagem)
  packageType?: PackageType; // Como o item é comprado (caixa, frasco...)
  packagePrice?: number; // Preço pago pela embalagem
  packageSize?: number; // Quantidade que vem na embalagem, na unidade de uso (ex: 20 par, 5000 ml)
  notes?: string;
}

export interface ProcedureItem {
  insumoId: string;
  quantity: number;
  notes?: string;
}

export interface ExternalProfessional {
  id: string;
  name: string;
  specialty: string;
  defaultCost: number;
}

export interface ExternalProfessionalAssignment {
  professionalId: string;
  cost: number;
}

export interface ExternalProfessionalCostDetail extends ExternalProfessionalAssignment {
  name: string;
  specialty: string;
}

export interface ExternalVeterinarian extends ExternalProfessional {}

export type ProcedureCategory = 'banho_tosa' | 'cirurgia' | 'internacao';

export interface Procedure {
  id: string;
  name: string;
  category: ProcedureCategory;
  description: string;
  targetWeightKg?: number; // Peso do animal em kg (ex: 5, 10, 15, 20, 30, 40)
  durationMinutes: number; // Tempo médio do procedimento em minutos (na internação, o período total)
  laborMinutes?: number; // Tempo de atendimento que entra no custo operacional (padrão: durationMinutes)
  anesthesiaCost?: number; // Custo do anestesista terceirizado lançado automaticamente
  externalProfessionalAssignments?: ExternalProfessionalAssignment[];
  externalVeterinarianId?: string;
  externalVeterinarianCost?: number;
  vetCommissionType?: 'percent' | 'fixed'; // Tipo de comissão do veterinário (% ou R$ fixo)
  vetCommissionValue?: number; // Valor da comissão (% sobre o preço ou valor em R$)
  vetCommissionRole?: string; // Papel do veterinário (ex: Cirurgião, Plantonista, etc.)
  items: ProcedureItem[];
  suggestedPrice?: number; // Preço de venda opcional
  targetMarginPercent?: number; // Margem de lucro opcional
  fixedOverheadCost?: number; // Custo operacional fixo adicional
}

export interface ClinicSettings {
  projectName?: string; // Nome principal do projeto/aplicativo (ex: VetCusto)
  clinicName: string; // Nome da clínica/unidade
  logoUrl?: string; // URL ou base64 da logo personalizada
  hourlyOperationalRate: number; // Custo por hora de funcionamento da clínica/mão de obra (R$/hora)
  defaultAnesthesiaCost?: number; // Custo padrão pré-lançado do anestesista terceirizado (ex: R$ 250)
  externalProfessionals?: ExternalProfessional[];
  externalVeterinarians?: ExternalVeterinarian[];
  defaultVetCommissionSurgeryPercent?: number; // Comissão padrão do cirurgião (% ex: 25%)
  defaultVetCommissionInternmentPercent?: number; // Comissão padrão do plantonista/internista (% ex: 20%)
  defaultVetCommissionBathPercent?: number; // Comissão padrão do tosador/banhista (% ex: 15%)
  includeLaborInCost: boolean;
}

export interface CalculationBreakdown {
  directCost: number; // Custo direto de insumos e materiais
  insumosCost: number; // Materiais (gaze, luvas, fios, etc.)
  externalProfessionalCost: number;
  vetCommissionCost: number; // Comissão do médico veterinário responsável
  operationalCost: number; // Mão de obra / Centro cirúrgico por minuto
  totalCost: number; // Insumos + profissionais terceirizados + comissão + operacional
  suggestedPriceByMargin?: number;
  currentPrice?: number;
  profitAtCurrentPrice?: number;
  marginAtCurrentPrice?: number;
}
