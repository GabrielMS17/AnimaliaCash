import { initialClinicSettings, initialInsumos } from './initialData';

export const ANESTHETIST_ID = 'prof_anesthetist_default';

/** Completa configurações salvas com os valores padrão e garante o anestesista quando há cirurgias que o usam. */
export function normalizeSettings(saved, procedures) {
  if (!saved) return initialClinicSettings;

  const externalProfessionals = [
    ...(saved.externalProfessionals ?? saved.externalVeterinarians ?? initialClinicSettings.externalProfessionals ?? []),
  ];
  const needsAnesthetist = procedures.some(
    (procedure) => procedure.category === 'cirurgia' && (procedure.anesthesiaCost ?? saved.defaultAnesthesiaCost ?? 250) > 0,
  );
  if (needsAnesthetist && !externalProfessionals.some((professional) => professional.id === ANESTHETIST_ID)) {
    externalProfessionals.push({
      id: ANESTHETIST_ID,
      name: 'Anestesista',
      specialty: 'Anestesiologia',
      defaultCost: saved.defaultAnesthesiaCost ?? 250,
    });
  }

  return {
    ...initialClinicSettings,
    ...saved,
    externalProfessionals,
    externalVeterinarians: undefined,
    projectName: saved.projectName || 'Animalia Cash',
  };
}

/**
 * Converte o formato antigo (anesthesiaCost / externalVeterinarianId) em profissionais terceirizados
 * e separa, na internação, a diária do tempo de atendimento da equipe.
 */
export function normalizeProcedures(procedures, settings) {
  const anesthetist = settings.externalProfessionals?.find((professional) => professional.id === ANESTHETIST_ID);

  return procedures.map((procedure) => {
    const assignments = [...(procedure.externalProfessionalAssignments ?? [])];
    if (procedure.externalVeterinarianId && !assignments.some((item) => item.professionalId === procedure.externalVeterinarianId)) {
      const veterinarian = settings.externalProfessionals?.find((item) => item.id === procedure.externalVeterinarianId);
      assignments.push({
        professionalId: procedure.externalVeterinarianId,
        cost: procedure.externalVeterinarianCost ?? veterinarian?.defaultCost ?? 0,
      });
    }
    const legacyAnesthesiaCost = procedure.category === 'cirurgia'
      ? procedure.anesthesiaCost ?? settings.defaultAnesthesiaCost ?? 250
      : 0;
    if (legacyAnesthesiaCost > 0 && anesthetist && !assignments.some((item) => item.professionalId === anesthetist.id)) {
      assignments.push({ professionalId: anesthetist.id, cost: legacyAnesthesiaCost });
    }

    const isLegacyInternment = procedure.category === 'internacao'
      && procedure.laborMinutes === undefined
      && procedure.durationMinutes < 1440;

    return {
      ...procedure,
      durationMinutes: isLegacyInternment ? 1440 : procedure.durationMinutes,
      laborMinutes: isLegacyInternment ? procedure.durationMinutes : procedure.laborMinutes,
      externalProfessionalAssignments: assignments.length > 0 ? assignments : undefined,
      anesthesiaCost: procedure.category === 'cirurgia' ? 0 : procedure.anesthesiaCost,
      externalVeterinarianId: undefined,
      externalVeterinarianCost: undefined,
    };
  });
}

/** Recupera insumos do catálogo inicial que algum procedimento usa mas que faltam nos dados salvos. */
export function restoreMissingInsumos(insumos, procedures) {
  const savedIds = new Set(insumos.map((insumo) => insumo.id));
  const referencedIds = new Set(procedures.flatMap((procedure) => procedure.items.map((item) => item.insumoId)));
  const missing = initialInsumos.filter((insumo) => !savedIds.has(insumo.id) && referencedIds.has(insumo.id));
  return [...insumos, ...missing];
}
