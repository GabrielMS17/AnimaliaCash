import { CalculationBreakdown, ClinicSettings, ExternalProfessionalCostDetail, Insumo, Procedure, ProcedureCategory } from '../types';

export function formatBRL(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Custo unitário: mostra até 4 casas para itens baratos (ex: R$ 0,018 por litro de água). */
export function formatUnitCost(value: number): string {
  if (value === null || value === undefined || isNaN(value)) return 'R$ 0,00';
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: value < 1 ? 4 : 2,
  });
}

export function formatDecimal(value: number, decimals: number = 2): string {
  if (isNaN(value)) return '0';
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}

export function formatPercent(value: number): string {
  if (isNaN(value)) return '0%';
  return `${value.toFixed(1).replace('.', ',')}%`;
}

export function formatDuration(minutes: number, category?: ProcedureCategory | string): string {
  if (!minutes || minutes <= 0) return '0 min';

  if (category === 'internacao' && minutes >= 1440 && minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 diária' : `${days} diárias`;
  }

  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes === 0 ? `${hours}h` : `${hours}h ${remainingMinutes}min`;
}

export function getCategoryLabel(category: ProcedureCategory | string): string {
  switch (category) {
    case 'banho_tosa':
      return 'Banho & Tosa';
    case 'cirurgia':
      return 'Cirurgias';
    case 'internacao':
      return 'Internação';
    case 'geral':
      return 'Geral';
    default:
      return category;
  }
}

/** Cor de destaque (bolinha) que identifica cada categoria. */
export function getCategoryDotClass(category: ProcedureCategory | string): string {
  switch (category) {
    case 'banho_tosa':
      return 'bg-sky-500';
    case 'cirurgia':
      return 'bg-rose-500';
    case 'internacao':
      return 'bg-amber-500';
    default:
      return 'bg-slate-400';
  }
}

export type WeightRange = 'todos' | 'pequeno' | 'medio' | 'grande';

export const WEIGHT_RANGES: { id: WeightRange; label: string }[] = [
  { id: 'todos', label: 'Todos os pesos' },
  { id: 'pequeno', label: 'Até 10 kg' },
  { id: 'medio', label: '10 a 25 kg' },
  { id: 'grande', label: 'Acima de 25 kg' },
];

export function matchesWeightRange(weightKg: number | undefined, range: WeightRange): boolean {
  if (range === 'todos') return true;
  if (weightKg === undefined) return false;
  if (range === 'pequeno') return weightKg <= 10;
  if (range === 'medio') return weightKg > 10 && weightKg <= 25;
  return weightKg > 25;
}

export interface ItemCostDetail {
  insumoId: string;
  insumoName: string;
  unit: string;
  quantity: number;
  costPerUnit: number;
  totalItemCost: number;
  percentageOfDirectCost: number;
  notes?: string;
  missing: boolean;
}

export interface DetailedProcedureCalculation {
  procedure: Procedure;
  breakdown: CalculationBreakdown;
  externalProfessionalDetails: ExternalProfessionalCostDetail[];
  itemDetails: ItemCostDetail[];
  itemsCount: number;
}

export function calculateProcedure(
  procedure: Procedure,
  insumosMap: Map<string, Insumo>,
  settings: ClinicSettings
): DetailedProcedureCalculation {
  let directCost = 0;
  const itemDetails: ItemCostDetail[] = [];

  for (const item of procedure.items) {
    const insumo = insumosMap.get(item.insumoId);
    const costPerUnit = insumo ? insumo.costPerUnit : 0;
    const totalItemCost = (item.quantity || 0) * costPerUnit;
    directCost += totalItemCost;

    itemDetails.push({
      insumoId: item.insumoId,
      insumoName: insumo ? insumo.name : 'Item não localizado',
      unit: insumo ? insumo.unit : 'un',
      quantity: item.quantity,
      costPerUnit,
      totalItemCost,
      percentageOfDirectCost: 0, // calculado abaixo
      notes: item.notes || insumo?.notes,
      missing: !insumo,
    });
  }

  // Calcular porcentagem de cada insumo no custo direto
  for (const detail of itemDetails) {
    detail.percentageOfDirectCost = directCost > 0 ? (detail.totalItemCost / directCost) * 100 : 0;
  }

  // Ordenar insumos pelo maior impacto financeiro
  itemDetails.sort((a, b) => b.totalItemCost - a.totalItemCost);

  // Mão de obra / Custo Operacional rateado pelo tempo de atendimento
  const hours = getLaborMinutes(procedure) / 60;
  const operationalCost = settings.includeLaborInCost
    ? hours * settings.hourlyOperationalRate + (procedure.fixedOverheadCost || 0)
    : (procedure.fixedOverheadCost || 0);

  // Custo do Anestesista Terceirizado (lançado automaticamente para cirurgias)
  const legacyAnesthesiaCost = procedure.category === 'cirurgia'
    ? (procedure.anesthesiaCost !== undefined ? procedure.anesthesiaCost : (settings.defaultAnesthesiaCost ?? 250))
    : (procedure.anesthesiaCost || 0);
  const assignments = [...(procedure.externalProfessionalAssignments ?? [])];
  if (procedure.externalVeterinarianId && !assignments.some((item) => item.professionalId === procedure.externalVeterinarianId)) {
    const professional = settings.externalProfessionals?.find((item) => item.id === procedure.externalVeterinarianId)
      ?? settings.externalVeterinarians?.find((item) => item.id === procedure.externalVeterinarianId);
    assignments.push({
      professionalId: procedure.externalVeterinarianId,
      cost: procedure.externalVeterinarianCost ?? professional?.defaultCost ?? 0,
    });
  }
  const anesthetist = settings.externalProfessionals?.find((item) => item.id === 'prof_anesthetist_default');
  const hasAnesthetist = assignments.some((assignment) => {
    const professional = settings.externalProfessionals?.find((item) => item.id === assignment.professionalId);
    return assignment.professionalId === 'prof_anesthetist_default' || professional?.specialty.toLowerCase().includes('anest');
  });
  if (legacyAnesthesiaCost > 0 && !hasAnesthetist) {
    assignments.push({
      professionalId: anesthetist?.id ?? 'prof_anesthetist_default',
      cost: legacyAnesthesiaCost,
    });
  }
  const externalProfessionalDetails = assignments.map((assignment) => {
    const professional = settings.externalProfessionals?.find((item) => item.id === assignment.professionalId)
      ?? settings.externalVeterinarians?.find((item) => item.id === assignment.professionalId);
    return {
      ...assignment,
      name: professional?.name ?? (assignment.professionalId === 'prof_anesthetist_default' ? 'Anestesista' : 'Profissional não cadastrado'),
      specialty: professional?.specialty ?? (assignment.professionalId === 'prof_anesthetist_default' ? 'Anestesiologia' : ''),
    };
  });
  const externalProfessionalCost = externalProfessionalDetails.reduce((total, item) => total + Math.max(0, item.cost), 0);

  // Comissão do Médico Veterinário / Profissional Responsável
  let vetCommissionCost = 0;
  if (procedure.vetCommissionType === 'fixed') {
    vetCommissionCost = procedure.vetCommissionValue || 0;
  } else {
    const commissionPercent = procedure.vetCommissionValue ?? getDefaultCommissionPercent(procedure.category, settings);
    if (commissionPercent > 0) {
      const baseForCommission = procedure.suggestedPrice && procedure.suggestedPrice > 0
        ? procedure.suggestedPrice
        : (directCost + externalProfessionalCost + operationalCost);
      vetCommissionCost = (baseForCommission * commissionPercent) / 100;
    }
  }

  // Custo Total da Clínica: insumos, equipe terceirizada, comissão e custo operacional.
  const totalCost = directCost + externalProfessionalCost + operationalCost + vetCommissionCost;

  const targetMargin = procedure.targetMarginPercent || 50;
  const suggestedPriceByMargin = targetMargin > 0 && targetMargin < 95
    ? totalCost / (1 - targetMargin / 100)
    : totalCost * (1 + targetMargin / 100);

  const currentPrice = procedure.suggestedPrice || totalCost;
  const profitAtCurrentPrice = currentPrice - totalCost;
  const marginAtCurrentPrice = currentPrice > 0 ? (profitAtCurrentPrice / currentPrice) * 100 : 0;

  return {
    procedure,
    breakdown: {
      directCost,
      insumosCost: directCost,
      externalProfessionalCost,
      vetCommissionCost,
      operationalCost,
      totalCost,
      suggestedPriceByMargin,
      currentPrice,
      profitAtCurrentPrice,
      marginAtCurrentPrice,
    },
    externalProfessionalDetails,
    itemDetails,
    itemsCount: itemDetails.length,
  };
}

/** Tempo que entra no custo operacional. Na internação é o atendimento da equipe, não a diária inteira. */
export function getLaborMinutes(procedure: Procedure): number {
  return procedure.laborMinutes ?? procedure.durationMinutes ?? 0;
}

export function getDefaultCommissionPercent(category: ProcedureCategory, settings: ClinicSettings): number {
  switch (category) {
    case 'cirurgia':
      return settings.defaultVetCommissionSurgeryPercent ?? 25;
    case 'internacao':
      return settings.defaultVetCommissionInternmentPercent ?? 20;
    case 'banho_tosa':
      return settings.defaultVetCommissionBathPercent ?? 15;
    default:
      return 0;
  }
}
