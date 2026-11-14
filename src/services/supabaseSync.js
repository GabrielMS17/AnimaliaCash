import { supabase } from '../supabase';

// Sincroniza o catálogo local (configurações, profissionais, insumos e procedimentos) com as tabelas
// descritas em supabase/schema.sql. Os dados são da clínica: todos os usuários logados veem os mesmos.
// Só o que mudou é enviado, para uma versão do sistema não apagar o que a outra acabou de gravar.

const BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function requireSession() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Faça login para sincronizar com o Supabase.');
}

const num = (value) => (value === null || value === undefined ? undefined : Number(value));
const orNull = (value) => (value === undefined || value === '' ? null : value);

/** Texto único para um valor, sem depender da ordem das chaves, para comparar versões de um registro. */
export function canonical(value) {
  return JSON.stringify(value, (_key, item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return item;
    return Object.fromEntries(Object.keys(item).sort().map((key) => [key, item[key]]));
  });
}

const byId = (a, b) => String(a.id).localeCompare(String(b.id));

/** Texto único para o estado inteiro, sem depender da ordem das listas. */
export function stateKey({ settings, insumos, procedures }) {
  return canonical({
    settings: { ...settings, externalProfessionals: [...(settings.externalProfessionals ?? [])].sort(byId) },
    insumos: [...insumos].sort(byId),
    procedures: [...procedures].sort(byId),
  });
}

function settingsRow(settings) {
  return {
    id: true,
    project_name: orNull(settings.projectName),
    clinic_name: settings.clinicName,
    logo_url: orNull(settings.logoUrl),
    hourly_operational_rate: settings.hourlyOperationalRate ?? 0,
    default_anesthesia_cost: orNull(settings.defaultAnesthesiaCost),
    default_vet_commission_surgery_percent: orNull(settings.defaultVetCommissionSurgeryPercent),
    default_vet_commission_internment_percent: orNull(settings.defaultVetCommissionInternmentPercent),
    default_vet_commission_bath_percent: orNull(settings.defaultVetCommissionBathPercent),
    average_product_waste_percent: settings.averageProductWastePercent ?? 0,
    include_labor_in_cost: Boolean(settings.includeLaborInCost),
    updated_at: new Date().toISOString(),
  };
}

const professionalRow = (professional) => ({
  id: professional.id,
  name: professional.name,
  specialty: professional.specialty,
  default_cost: professional.defaultCost ?? 0,
  updated_at: new Date().toISOString(),
});

const insumoRow = (insumo) => ({
  id: insumo.id,
  name: insumo.name,
  category: insumo.category,
  unit: insumo.unit,
  cost_per_unit: insumo.costPerUnit,
  package_type: orNull(insumo.packageType),
  package_price: orNull(insumo.packagePrice),
  package_size: orNull(insumo.packageSize),
  notes: orNull(insumo.notes),
  brand: orNull(insumo.brand),
  min_stock: orNull(insumo.minStock),
  track_stock: insumo.trackStock ?? null,
  updated_at: new Date().toISOString(),
});

const procedureRow = (procedure) => ({
  id: procedure.id,
  name: procedure.name,
  category: procedure.category,
  description: procedure.description ?? '',
  target_weight_kg: orNull(procedure.targetWeightKg),
  duration_minutes: Math.round(procedure.durationMinutes ?? 0),
  labor_minutes: procedure.laborMinutes === undefined ? null : Math.round(procedure.laborMinutes),
  anesthesia_cost: orNull(procedure.anesthesiaCost),
  fixed_overhead_cost: orNull(procedure.fixedOverheadCost),
  vet_commission_type: orNull(procedure.vetCommissionType),
  vet_commission_value: orNull(procedure.vetCommissionValue),
  vet_commission_role: orNull(procedure.vetCommissionRole),
  suggested_price: orNull(procedure.suggestedPrice),
  target_margin_percent: orNull(procedure.targetMarginPercent),
  updated_at: new Date().toISOString(),
});

async function inBatches(rows, send) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await run(send(rows.slice(i, i + BATCH_SIZE)));
  }
}

/** Separa o que foi criado/alterado e o que foi removido em uma lista, em relação à versão anterior. */
function diffList(previous, next) {
  const before = new Map(previous.map((item) => [item.id, canonical(item)]));
  const ids = new Set(next.map((item) => item.id));
  return {
    changed: next.filter((item) => before.get(item.id) !== canonical(item)),
    removedIds: previous.filter((item) => !ids.has(item.id)).map((item) => item.id),
  };
}

/**
 * Envia as diferenças entre a última versão sincronizada (base) e o estado local (next).
 * Sem base, envia tudo sem apagar nada. Registros que o dispositivo não conhece nunca são tocados.
 */
export async function pushChanges(base, next) {
  await requireSession();

  const baseProfessionals = base?.settings.externalProfessionals ?? [];
  const nextProfessionals = next.settings.externalProfessionals ?? [];
  const professionals = diffList(baseProfessionals, nextProfessionals);
  const insumos = diffList(base?.insumos ?? [], next.insumos);
  const procedures = diffList(base?.procedures ?? [], next.procedures);

  const withoutProfessionals = (settings) => ({ ...settings, externalProfessionals: undefined });
  if (!base || canonical(withoutProfessionals(base.settings)) !== canonical(withoutProfessionals(next.settings))) {
    await run(supabase.from('clinic_settings').upsert(settingsRow(next.settings)));
  }

  await inBatches(professionals.changed.map(professionalRow), (rows) => supabase.from('external_professionals').upsert(rows));
  await inBatches(insumos.changed.map(insumoRow), (rows) => supabase.from('insumos').upsert(rows));
  await inBatches(procedures.changed.map(procedureRow), (rows) => supabase.from('procedures').upsert(rows));

  // A ficha técnica de um procedimento alterado é regravada por inteiro
  const changedIds = procedures.changed.map((procedure) => procedure.id);
  if (changedIds.length > 0) {
    await inBatches(changedIds, (ids) => supabase.from('procedure_items').delete().in('procedure_id', ids));
    await inBatches(changedIds, (ids) => supabase.from('procedure_professionals').delete().in('procedure_id', ids));
  }

  // Itens que apontam para insumos/profissionais inexistentes não têm como ser gravados (chave estrangeira)
  const insumoIds = new Set(next.insumos.map((insumo) => insumo.id));
  const professionalIds = new Set(nextProfessionals.map((professional) => professional.id));
  await inBatches(procedures.changed.flatMap((procedure) =>
    procedure.items
      .filter((item) => insumoIds.has(item.insumoId))
      .map((item, position) => ({
        procedure_id: procedure.id,
        position,
        insumo_id: item.insumoId,
        quantity: item.quantity ?? 0,
        notes: orNull(item.notes),
      })),
  ), (rows) => supabase.from('procedure_items').insert(rows));
  await inBatches(procedures.changed.flatMap((procedure) =>
    (procedure.externalProfessionalAssignments ?? [])
      .filter((assignment) => professionalIds.has(assignment.professionalId))
      .map((assignment) => ({
        procedure_id: procedure.id,
        professional_id: assignment.professionalId,
        cost: assignment.cost ?? 0,
      })),
  ), (rows) => supabase.from('procedure_professionals').insert(rows));

  await inBatches(procedures.removedIds, (ids) => supabase.from('procedures').delete().in('id', ids));
  await inBatches(insumos.removedIds, (ids) => supabase.from('insumos').delete().in('id', ids));
  await inBatches(professionals.removedIds, (ids) => supabase.from('external_professionals').delete().in('id', ids));
}

/** Lê uma tabela inteira, em páginas (o Supabase devolve no máximo 1000 linhas por consulta). */
async function selectAll(table, ...orderColumns) {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select('*');
    for (const column of orderColumns) query = query.order(column);
    const page = await run(query.range(from, from + PAGE_SIZE - 1));
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

/** Lê os dados da clínica. Retorna null quando ainda não há nada salvo no Supabase. */
export async function pullAll() {
  await requireSession();

  const [settingsRows, professionals, insumos, procedures, items, assignments] = await Promise.all([
    run(supabase.from('clinic_settings').select('*')),
    selectAll('external_professionals', 'id'),
    selectAll('insumos', 'id'),
    selectAll('procedures', 'id'),
    selectAll('procedure_items', 'procedure_id', 'position'),
    selectAll('procedure_professionals', 'procedure_id', 'professional_id'),
  ]);

  const row = settingsRows[0];
  if (!row && insumos.length === 0 && procedures.length === 0) return null;

  const settings = row && {
    projectName: row.project_name ?? undefined,
    clinicName: row.clinic_name,
    logoUrl: row.logo_url ?? undefined,
    hourlyOperationalRate: num(row.hourly_operational_rate) ?? 0,
    defaultAnesthesiaCost: num(row.default_anesthesia_cost),
    defaultVetCommissionSurgeryPercent: num(row.default_vet_commission_surgery_percent),
    defaultVetCommissionInternmentPercent: num(row.default_vet_commission_internment_percent),
    defaultVetCommissionBathPercent: num(row.default_vet_commission_bath_percent),
    averageProductWastePercent: num(row.average_product_waste_percent) ?? 0,
    includeLaborInCost: row.include_labor_in_cost,
    externalProfessionals: professionals.map((professional) => ({
      id: professional.id,
      name: professional.name,
      specialty: professional.specialty,
      defaultCost: num(professional.default_cost) ?? 0,
    })),
  };

  const itemsByProcedure = groupBy(items, (item) => item.procedure_id);
  const assignmentsByProcedure = groupBy(assignments, (assignment) => assignment.procedure_id);

  return {
    settings,
    insumos: insumos.map((insumo) => ({
      id: insumo.id,
      name: insumo.name,
      category: insumo.category,
      unit: insumo.unit,
      costPerUnit: num(insumo.cost_per_unit) ?? 0,
      packageType: insumo.package_type ?? undefined,
      packagePrice: num(insumo.package_price),
      packageSize: num(insumo.package_size),
      notes: insumo.notes ?? undefined,
      brand: insumo.brand ?? undefined,
      minStock: num(insumo.min_stock),
      trackStock: insumo.track_stock ?? undefined,
    })),
    procedures: procedures.map((procedure) => {
      const procedureAssignments = (assignmentsByProcedure.get(procedure.id) ?? [])
        .map((assignment) => ({ professionalId: assignment.professional_id, cost: num(assignment.cost) ?? 0 }));
      return {
        id: procedure.id,
        name: procedure.name,
        category: procedure.category,
        description: procedure.description ?? '',
        targetWeightKg: num(procedure.target_weight_kg),
        durationMinutes: procedure.duration_minutes,
        laborMinutes: num(procedure.labor_minutes),
        anesthesiaCost: num(procedure.anesthesia_cost),
        fixedOverheadCost: num(procedure.fixed_overhead_cost),
        vetCommissionType: procedure.vet_commission_type ?? undefined,
        vetCommissionValue: num(procedure.vet_commission_value),
        vetCommissionRole: procedure.vet_commission_role ?? undefined,
        suggestedPrice: num(procedure.suggested_price),
        targetMarginPercent: num(procedure.target_margin_percent),
        externalProfessionalAssignments: procedureAssignments.length > 0 ? procedureAssignments : undefined,
        items: (itemsByProcedure.get(procedure.id) ?? [])
          .map((item) => ({ insumoId: item.insumo_id, quantity: num(item.quantity) ?? 0, notes: item.notes ?? undefined })),
      };
    }),
  };
}

function groupBy(list, getKey) {
  const groups = new Map();
  for (const item of list) {
    const key = getKey(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}
