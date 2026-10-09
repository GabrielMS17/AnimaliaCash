import { supabase } from '../supabase';

// Sincroniza o catálogo local (configurações, profissionais, insumos e procedimentos) com as tabelas
// descritas em supabase/schema.sql. Cada usuário só enxerga as próprias linhas (RLS por owner_id).

const BATCH_SIZE = 500;

async function run(query) {
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data;
}

async function getOwnerId() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) throw new Error('Faça login para sincronizar com o Supabase.');
  return session.user.id;
}

const num = (value) => (value === null || value === undefined ? undefined : Number(value));
const orNull = (value) => (value === undefined || value === '' ? null : value);
const quoteId = (id) => `"${String(id).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;

async function insertInBatches(table, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await run(supabase.from(table).insert(rows.slice(i, i + BATCH_SIZE)));
  }
}

/** Grava as linhas e remove do banco as que não existem mais localmente. */
async function upsertAndPrune(table, ownerId, rows) {
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await run(supabase.from(table).upsert(rows.slice(i, i + BATCH_SIZE), { onConflict: 'owner_id,id' }));
  }
  const prune = supabase.from(table).delete().eq('owner_id', ownerId);
  await run(rows.length > 0 ? prune.not('id', 'in', `(${rows.map((row) => quoteId(row.id)).join(',')})`) : prune);
}

/** Envia todos os dados locais para a conta logada e retorna o id dela. */
export async function pushAll({ settings, insumos, procedures }) {
  const ownerId = await getOwnerId();
  const professionals = settings.externalProfessionals ?? [];
  const insumoIds = new Set(insumos.map((insumo) => insumo.id));
  const professionalIds = new Set(professionals.map((professional) => professional.id));

  await run(
    supabase.from('clinic_settings').upsert({
      owner_id: ownerId,
      project_name: orNull(settings.projectName),
      clinic_name: settings.clinicName,
      logo_url: orNull(settings.logoUrl),
      hourly_operational_rate: settings.hourlyOperationalRate ?? 0,
      default_anesthesia_cost: orNull(settings.defaultAnesthesiaCost),
      default_vet_commission_surgery_percent: orNull(settings.defaultVetCommissionSurgeryPercent),
      default_vet_commission_internment_percent: orNull(settings.defaultVetCommissionInternmentPercent),
      default_vet_commission_bath_percent: orNull(settings.defaultVetCommissionBathPercent),
      include_labor_in_cost: Boolean(settings.includeLaborInCost),
      updated_at: new Date().toISOString(),
    }),
  );

  // Os itens dos procedimentos são regravados por inteiro a cada envio
  await run(supabase.from('procedure_items').delete().eq('owner_id', ownerId));
  await run(supabase.from('procedure_professionals').delete().eq('owner_id', ownerId));

  await upsertAndPrune('external_professionals', ownerId, professionals.map((professional) => ({
    owner_id: ownerId,
    id: professional.id,
    name: professional.name,
    specialty: professional.specialty,
    default_cost: professional.defaultCost ?? 0,
  })));

  await upsertAndPrune('insumos', ownerId, insumos.map((insumo) => ({
    owner_id: ownerId,
    id: insumo.id,
    name: insumo.name,
    category: insumo.category,
    unit: insumo.unit,
    cost_per_unit: insumo.costPerUnit,
    package_type: orNull(insumo.packageType),
    package_price: orNull(insumo.packagePrice),
    package_size: orNull(insumo.packageSize),
    notes: orNull(insumo.notes),
    updated_at: new Date().toISOString(),
  })));

  await upsertAndPrune('procedures', ownerId, procedures.map((procedure) => ({
    owner_id: ownerId,
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
  })));

  // Itens que apontam para insumos/profissionais inexistentes não têm como ser gravados (chave estrangeira)
  await insertInBatches('procedure_items', procedures.flatMap((procedure) =>
    procedure.items
      .filter((item) => insumoIds.has(item.insumoId))
      .map((item, position) => ({
        owner_id: ownerId,
        procedure_id: procedure.id,
        position,
        insumo_id: item.insumoId,
        quantity: item.quantity ?? 0,
        notes: orNull(item.notes),
      })),
  ));

  await insertInBatches('procedure_professionals', procedures.flatMap((procedure) =>
    (procedure.externalProfessionalAssignments ?? [])
      .filter((assignment) => professionalIds.has(assignment.professionalId))
      .map((assignment) => ({
        owner_id: ownerId,
        procedure_id: procedure.id,
        professional_id: assignment.professionalId,
        cost: assignment.cost ?? 0,
      })),
  ));

  return ownerId;
}

/** Lê os dados do usuário logado. Retorna null quando ainda não há nada salvo no Supabase. */
export async function pullAll() {
  const ownerId = await getOwnerId();
  const byOwner = (table, order = 'id') => supabase.from(table).select('*').eq('owner_id', ownerId).order(order);

  const [settingsRows, professionals, insumos, procedures, items, assignments] = await Promise.all([
    run(supabase.from('clinic_settings').select('*').eq('owner_id', ownerId)),
    run(byOwner('external_professionals', 'name')),
    run(byOwner('insumos', 'name')),
    run(byOwner('procedures', 'name')),
    run(byOwner('procedure_items', 'position')),
    run(byOwner('procedure_professionals', 'professional_id')),
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
    includeLaborInCost: row.include_labor_in_cost,
    externalProfessionals: professionals.map((professional) => ({
      id: professional.id,
      name: professional.name,
      specialty: professional.specialty,
      defaultCost: num(professional.default_cost) ?? 0,
    })),
  };

  return {
    ownerId,
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
    })),
    procedures: procedures.map((procedure) => {
      const procedureAssignments = assignments
        .filter((assignment) => assignment.procedure_id === procedure.id)
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
        items: items
          .filter((item) => item.procedure_id === procedure.id)
          .map((item) => ({ insumoId: item.insumo_id, quantity: num(item.quantity) ?? 0, notes: item.notes ?? undefined })),
      };
    }),
  };
}
