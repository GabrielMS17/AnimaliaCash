import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  calculateProcedure,
  formatBRL,
  formatDecimal,
  formatUnitCost,
  getCategoryLabel,
  getDefaultCommissionPercent,
} from '../utils/costCalculations';
import { UNIT_OPTIONS } from './InsumoModal';
import {
  AppModal,
  Button,
  COLORS,
  ErrorBanner,
  Field,
  Input,
  NumberInput,
  Segmented,
  Select,
  useAccent,
  useIsWide,
} from './ui';

const COMMON_SURGERIES = [
  'Castração Fêmea',
  'Castração Macho',
  'Tartarectomia (Limpeza de Tártaro)',
  'Cesariana de Emergência',
  'Piometra',
  'Osteossíntese de Fêmur',
  'Enucleação Ocular',
  'Mastectomia Total / Parcial',
  'Laparotomia Exploratória',
];

const DEFAULT_ROLE = {
  cirurgia: 'Cirurgião Veterinário',
  internacao: 'Veterinário Plantonista',
  banho_tosa: 'Banhista / Tosador',
};

const NOUN = {
  cirurgia: { edit: 'Editar cirurgia', create: 'Nova cirurgia' },
  banho_tosa: { edit: 'Editar banho & tosa', create: 'Novo banho & tosa' },
  internacao: { edit: 'Editar diária de internação', create: 'Nova diária de internação' },
};

function getAutoName(category, weight) {
  if (category === 'banho_tosa') return weight ? `Banho & Tosa (${weight} kg)` : 'Banho & Tosa';
  if (category === 'internacao') return weight ? `Diária de Internação (${weight} kg)` : 'Diária de Internação';
  return '';
}

export default function ProcedureEditModal({ procedure, defaultCategory, insumos, insumosMap, settings, onClose, onSave, onQuickCreateInsumo }) {
  const category = procedure?.category ?? defaultCategory;
  const isEditing = Boolean(procedure);
  const isWide = useIsWide(900);

  const [procedureId] = useState(() => procedure?.id ?? `proc_${Date.now()}`);
  const [tab, setTab] = useState('geral');
  const [errorMsg, setErrorMsg] = useState('');

  // Nomes automáticos (ex: "Banho & Tosa (20 kg)") ficam vazios para acompanhar a mudança de peso
  const [name, setName] = useState(() =>
    procedure && procedure.name !== getAutoName(category, procedure.targetWeightKg) ? procedure.name : '',
  );
  const [targetWeightKg, setTargetWeightKg] = useState(procedure?.targetWeightKg ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(procedure?.durationMinutes ?? (category === 'internacao' ? 1440 : 60));
  const [laborMinutes, setLaborMinutes] = useState(procedure?.laborMinutes ?? 180);
  const [description, setDescription] = useState(procedure?.description ?? '');

  const [professionalAssignments, setProfessionalAssignments] = useState(() =>
    (procedure?.externalProfessionalAssignments ?? []).map((assignment) => ({ ...assignment })),
  );
  const [professionalToAdd, setProfessionalToAdd] = useState('');
  const [vetCommissionType, setVetCommissionType] = useState(procedure?.vetCommissionType ?? 'percent');
  const [vetCommissionValue, setVetCommissionValue] = useState(
    procedure?.vetCommissionValue ?? getDefaultCommissionPercent(category, settings),
  );
  const [vetCommissionRole, setVetCommissionRole] = useState(procedure?.vetCommissionRole ?? DEFAULT_ROLE[category]);
  const [price, setPrice] = useState(procedure?.suggestedPrice ?? 0);

  // Cópia própria dos itens, para que "Cancelar" não altere o procedimento original
  const [items, setItems] = useState(() => (procedure?.items ?? []).map((item) => ({ ...item })));
  const [insumoSearch, setInsumoSearch] = useState('');
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);

  const autoName = getAutoName(category, targetWeightKg);
  const finalName = name.trim() || autoName;

  const draft = {
    ...procedure,
    id: procedureId,
    name: finalName,
    category,
    description: description.trim(),
    targetWeightKg: targetWeightKg > 0 ? targetWeightKg : undefined,
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
    laborMinutes: category === 'internacao' ? Math.max(0, laborMinutes) : procedure?.laborMinutes,
    anesthesiaCost: category === 'cirurgia' ? 0 : procedure?.anesthesiaCost,
    externalProfessionalAssignments: category === 'cirurgia' && professionalAssignments.length > 0
      ? professionalAssignments.map((assignment) => ({ ...assignment, cost: Math.max(0, assignment.cost) }))
      : undefined,
    externalVeterinarianId: undefined,
    externalVeterinarianCost: undefined,
    vetCommissionType,
    vetCommissionValue: Math.max(0, vetCommissionValue),
    vetCommissionRole: vetCommissionRole.trim() || undefined,
    suggestedPrice: price > 0 ? price : undefined,
    items,
  };
  const { breakdown } = calculateProcedure(draft, insumosMap, settings);

  // Catálogo: só os insumos da mesma categoria do procedimento
  const categoryInsumos = useMemo(
    () => insumos.filter((insumo) => insumo.category === category).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [insumos, category],
  );
  const filteredCatalog = useMemo(() => {
    const query = insumoSearch.trim().toLowerCase();
    return query
      ? categoryInsumos.filter((insumo) => insumo.name.toLowerCase().includes(query) || (insumo.notes ?? '').toLowerCase().includes(query))
      : categoryInsumos;
  }, [categoryInsumos, insumoSearch]);
  const addedQuantity = useMemo(() => new Map(items.map((item) => [item.insumoId, item.quantity])), [items]);

  const availableProfessionals = (settings.externalProfessionals ?? []).filter(
    (professional) => !professionalAssignments.some((item) => item.professionalId === professional.id),
  );

  const addExternalProfessional = () => {
    const professional = settings.externalProfessionals?.find((item) => item.id === professionalToAdd);
    if (!professional) return;
    setProfessionalAssignments((prev) => [...prev, { professionalId: professional.id, cost: professional.defaultCost }]);
    setProfessionalToAdd('');
  };

  const updateItem = (index, patch) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  const addInsumo = (insumoId) => {
    setItems((prev) => {
      const existing = prev.findIndex((item) => item.insumoId === insumoId);
      if (existing >= 0) {
        return prev.map((item, i) => (i === existing ? { ...item, quantity: Math.round((item.quantity + 1) * 1000) / 1000 } : item));
      }
      return [...prev, { insumoId, quantity: 1 }];
    });
  };

  const handleSave = () => {
    if (!finalName) {
      setTab('geral');
      setErrorMsg('Informe o nome da cirurgia.');
      return;
    }
    onSave(draft);
  };

  const tabs = [
    { value: 'geral', label: 'Dados gerais' },
    { value: 'insumos', label: `Insumos (${items.length})` },
    { value: 'custos', label: 'Custos' },
  ];

  return (
    <AppModal
      title={isEditing ? NOUN[category].edit : NOUN[category].create}
      maxWidth={980}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <View>
            <Text style={styles.small}>Custo total</Text>
            <Text style={styles.footerTotal}>{formatBRL(breakdown.totalCost)}</Text>
          </View>
          <View style={styles.footerButtons}>
            <Button label="Cancelar" variant="secondary" onPress={onClose} />
            <Button label={isEditing ? 'Salvar alterações' : 'Criar procedimento'} onPress={handleSave} />
          </View>
        </View>
      }
    >
      <Segmented options={tabs} value={tab} onChange={setTab} />
      <ErrorBanner message={errorMsg} />

      {tab === 'geral' && (
        <View style={styles.stack}>
          <Field
            label={category === 'cirurgia' ? 'Nome' : 'Nome (opcional)'}
            hint={category === 'cirurgia' ? undefined : `Se deixar em branco, será usado "${autoName}".`}
          >
            <Input
              placeholder={category === 'cirurgia' ? 'Ex: Castração Fêmea' : autoName}
              value={name}
              onChangeText={(text) => {
                setName(text);
                setErrorMsg('');
              }}
            />
          </Field>
          {category === 'cirurgia' && !name.trim() && (
            <View style={styles.chips}>
              {COMMON_SURGERIES.map((surgery) => (
                <Pressable key={surgery} onPress={() => setName(surgery)} style={styles.chip}>
                  <Text style={styles.chipText}>{surgery}</Text>
                </Pressable>
              ))}
            </View>
          )}

          <View style={[styles.grid, isWide && styles.row]}>
            <Field label="Peso do animal" style={styles.cell}>
              <NumberInput suffix="kg" min={0} value={targetWeightKg} onChange={setTargetWeightKg} />
            </Field>
            {category === 'internacao' ? (
              <Field label="Duração" style={styles.cell}>
                <NumberInput
                  suffix="diárias"
                  min={0.25}
                  value={Math.round((durationMinutes / 1440) * 100) / 100}
                  onChange={(days) => setDurationMinutes(Math.round(days * 1440))}
                />
              </Field>
            ) : (
              <Field label="Duração" style={styles.cell}>
                <NumberInput suffix="min" min={1} value={durationMinutes} onChange={setDurationMinutes} />
              </Field>
            )}
            {category === 'internacao' && (
              <Field label="Tempo de atendimento" hint="Horas da equipe no período; é o que entra no custo operacional." style={styles.cell}>
                <NumberInput
                  suffix="h"
                  min={0}
                  value={Math.round((laborMinutes / 60) * 100) / 100}
                  onChange={(hours) => setLaborMinutes(Math.round(hours * 60))}
                />
              </Field>
            )}
          </View>

          <Field label="Descrição (opcional)">
            <Input
              multiline
              numberOfLines={3}
              placeholder="Protocolo, observações clínicas…"
              value={description}
              onChangeText={setDescription}
              style={{ minHeight: 76, textAlignVertical: 'top' }}
            />
          </Field>
        </View>
      )}

      {tab === 'insumos' && (
        <View style={[styles.grid, isWide && styles.row]}>
          {/* Catálogo: insumos da mesma categoria do procedimento */}
          <View style={styles.cell}>
            <View style={styles.listHeader}>
              <Text style={styles.heading}>
                Insumos de {getCategoryLabel(category)} <Text style={styles.small}>({categoryInsumos.length})</Text>
              </Text>
              <Button small variant="ghost" label={isQuickCreateOpen ? 'Fechar' : '+ Cadastrar'} onPress={() => setIsQuickCreateOpen((open) => !open)} />
            </View>

            {isQuickCreateOpen && (
              <QuickCreateInsumo
                category={category}
                onCancel={() => setIsQuickCreateOpen(false)}
                onCreate={(insumo) => {
                  onQuickCreateInsumo(insumo);
                  setItems((prev) => [...prev, { insumoId: insumo.id, quantity: 1 }]);
                  setIsQuickCreateOpen(false);
                }}
              />
            )}

            <Input placeholder="Filtrar" value={insumoSearch} onChangeText={setInsumoSearch} style={{ marginBottom: 8 }} />

            <View style={styles.box}>
              {filteredCatalog.map((insumo) => {
                const added = addedQuantity.get(insumo.id);
                return (
                  <CatalogRow key={insumo.id} insumo={insumo} added={added} onPress={() => addInsumo(insumo.id)} />
                );
              })}
              {filteredCatalog.length === 0 && (
                <Text style={styles.emptyText}>
                  {categoryInsumos.length === 0
                    ? `Nenhum insumo cadastrado na categoria ${getCategoryLabel(category)}.`
                    : 'Nenhum insumo encontrado.'}
                </Text>
              )}
            </View>
          </View>

          {/* Itens já adicionados ao procedimento */}
          <View style={styles.cell}>
            <Text style={[styles.heading, { marginBottom: 8 }]}>
              Adicionados <Text style={styles.small}>({items.length})</Text>
            </Text>
            {items.length > 0 ? (
              <View style={styles.box}>
                {items.map((item, index) => {
                  const insumo = insumosMap.get(item.insumoId);
                  return (
                    <View key={`${item.insumoId}-${index}`} style={styles.addedRow}>
                      <View style={{ flex: 1, minWidth: 0 }}>
                        <Text style={[styles.itemName, !insumo && { color: COLORS.warning }]} numberOfLines={1}>
                          {insumo ? insumo.name : `⚠ Não encontrado (${item.insumoId})`}
                        </Text>
                        <Input
                          placeholder="Adicionar observação"
                          value={item.notes ?? ''}
                          onChangeText={(text) => updateItem(index, { notes: text })}
                          style={styles.noteInput}
                        />
                      </View>
                      <NumberInput
                        min={0}
                        suffix={insumo?.unit ?? ''}
                        value={item.quantity}
                        onChange={(quantity) => updateItem(index, { quantity })}
                        style={{ width: 96 }}
                      />
                      <Text style={styles.itemCost}>{formatBRL((item.quantity || 0) * (insumo?.costPerUnit ?? 0))}</Text>
                      <Button small variant="danger" label="✕" onPress={() => setItems((prev) => prev.filter((_, i) => i !== index))} />
                    </View>
                  );
                })}
                <View style={styles.totalRow}>
                  <Text style={styles.small}>Total de insumos</Text>
                  <Text style={styles.heading}>{formatBRL(breakdown.directCost)}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <Text style={styles.itemName}>Nenhum insumo adicionado.</Text>
                <Text style={styles.small}>Toque em um insumo da lista para incluí-lo.</Text>
              </View>
            )}
          </View>
        </View>
      )}

      {tab === 'custos' && (
        <View style={[styles.grid, isWide && styles.row]}>
          <View style={[styles.cell, styles.stack, isWide && { flex: 3 }]}>
            {category === 'cirurgia' && (
              <View style={styles.stack}>
                <Text style={styles.heading}>Profissionais terceirizados</Text>
                <View style={styles.inline}>
                  <Select
                    value={professionalToAdd}
                    placeholder="Selecione anestesista ou especialista"
                    options={availableProfessionals.map((professional) => ({
                      value: professional.id,
                      label: `${professional.name} · ${professional.specialty}`,
                    }))}
                    onChange={setProfessionalToAdd}
                    style={{ flex: 1, minWidth: 200 }}
                  />
                  <Button variant="secondary" label="Adicionar" disabled={!professionalToAdd} onPress={addExternalProfessional} />
                </View>
                {(settings.externalProfessionals ?? []).length === 0 && (
                  <Text style={styles.small}>Cadastre profissionais em Configurações para selecioná-los aqui.</Text>
                )}
                {professionalAssignments.map((assignment) => {
                  const professional = settings.externalProfessionals?.find((item) => item.id === assignment.professionalId);
                  return (
                    <View key={assignment.professionalId} style={styles.professionalRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.itemName}>{professional?.name ?? 'Profissional não cadastrado'}</Text>
                        <Text style={styles.small}>{professional?.specialty}</Text>
                      </View>
                      <NumberInput
                        prefix="R$"
                        min={0}
                        value={assignment.cost}
                        onChange={(cost) => setProfessionalAssignments((prev) =>
                          prev.map((item) => (item.professionalId === assignment.professionalId ? { ...item, cost } : item)),
                        )}
                        style={{ width: 130 }}
                      />
                      <Button
                        small
                        variant="danger"
                        label="✕"
                        onPress={() => setProfessionalAssignments((prev) => prev.filter((item) => item.professionalId !== assignment.professionalId))}
                      />
                    </View>
                  );
                })}
              </View>
            )}

            {category === 'cirurgia' && (
              <View style={styles.stack}>
                <Text style={styles.heading}>Comissão do profissional</Text>
                <Field label="Profissional">
                  <Input value={vetCommissionRole} onChangeText={setVetCommissionRole} />
                </Field>
                <View style={[styles.grid, styles.row]}>
                  <Field label="Tipo" style={styles.cell}>
                    <Segmented
                      options={[{ value: 'percent', label: 'Percentual' }, { value: 'fixed', label: 'Valor fixo' }]}
                      value={vetCommissionType}
                      onChange={setVetCommissionType}
                    />
                  </Field>
                  <Field label={vetCommissionType === 'percent' ? 'Percentual' : 'Valor'} style={styles.cell}>
                    {vetCommissionType === 'percent' ? (
                      <NumberInput suffix="%" min={0} max={100} value={vetCommissionValue} onChange={setVetCommissionValue} />
                    ) : (
                      <NumberInput prefix="R$" min={0} value={vetCommissionValue} onChange={setVetCommissionValue} />
                    )}
                  </Field>
                </View>
              </View>
            )}

            <Field
              label="Preço cobrado do tutor (opcional)"
              hint="Quando informado, a comissão percentual é calculada sobre este preço. Sem preço, ela incide sobre os demais custos."
            >
              <NumberInput prefix="R$" min={0} placeholder="0,00" value={price} onChange={setPrice} />
            </Field>
          </View>

          <View style={[styles.cell, isWide && { flex: 2 }]}>
            <View style={styles.summary}>
              <Text style={[styles.heading, { marginBottom: 10 }]}>Composição do custo</Text>
              <SummaryRow label="Insumos" value={breakdown.directCost} />
              {breakdown.externalProfessionalCost > 0 && (
                <SummaryRow label="Profissionais terceirizados" value={breakdown.externalProfessionalCost} />
              )}
              <SummaryRow label="Comissão" value={breakdown.vetCommissionCost} />
              <SummaryRow label="Operacional" value={breakdown.operationalCost} />
              <View style={styles.summaryTotal}>
                <Text style={styles.heading}>Total</Text>
                <Text style={styles.heading}>{formatBRL(breakdown.totalCost)}</Text>
              </View>
              <Text style={[styles.small, { marginTop: 10 }]}>
                Operacional: {category === 'internacao' ? 'tempo de atendimento' : 'duração'} × {formatBRL(settings.hourlyOperationalRate)}/h da clínica.
              </Text>
            </View>
          </View>
        </View>
      )}
    </AppModal>
  );
}

function CatalogRow({ insumo, added, onPress }) {
  const accent = useAccent();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.catalogRow, pressed && { backgroundColor: accent.soft }]}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.itemName} numberOfLines={1}>{insumo.name}</Text>
        <Text style={styles.small}>{formatUnitCost(insumo.costPerUnit)} / {insumo.unit}</Text>
      </View>
      {added !== undefined ? (
        <Text style={[styles.addedBadge, { color: accent.accent, backgroundColor: accent.soft }]}>
          ✓ {formatDecimal(added, 3)} {insumo.unit}
        </Text>
      ) : (
        <Text style={styles.plus}>+</Text>
      )}
    </Pressable>
  );
}

function SummaryRow({ label, value }) {
  return (
    <View style={styles.summaryRow}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{formatBRL(value)}</Text>
    </View>
  );
}

function QuickCreateInsumo({ category, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState(0);
  const [unit, setUnit] = useState('un');
  const [error, setError] = useState('');

  const handleCreate = () => {
    if (!name.trim()) return setError('Informe o nome do insumo.');
    if (cost <= 0) return setError('Informe um custo maior que zero.');
    onCreate({ id: `ins_custom_${Date.now()}`, name: name.trim(), category, unit, costPerUnit: cost });
  };

  return (
    <View style={styles.quickCreate}>
      <Text style={styles.heading}>Novo insumo</Text>
      {error ? <Text style={{ color: COLORS.danger, fontSize: 13 }}>{error}</Text> : null}
      <Input placeholder="Nome" value={name} onChangeText={setName} />
      <View style={styles.inline}>
        <NumberInput prefix="R$" min={0} placeholder="Custo" value={cost} onChange={setCost} style={{ flex: 1, minWidth: 110 }} />
        <Select value={unit} options={UNIT_OPTIONS.map((option) => ({ value: option.value, label: option.value }))} onChange={setUnit} style={{ minWidth: 80 }} />
      </View>
      <View style={styles.footerButtons}>
        <Button small variant="secondary" label="Cancelar" onPress={onCancel} />
        <Button small label="Adicionar ao procedimento" onPress={handleCreate} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  footerTotal: { fontSize: 19, fontWeight: '800', color: COLORS.text },
  footerButtons: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  stack: { gap: 14 },
  grid: { gap: 16 },
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  cell: { flex: 1, minWidth: 0 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -6 },
  chip: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 999, backgroundColor: '#F1F5F9' },
  chipText: { fontSize: 12, color: COLORS.textSoft },
  heading: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  small: { fontSize: 12, color: COLORS.muted, fontWeight: '400' },
  listHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  box: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  catalogRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  addedBadge: { fontSize: 12, fontWeight: '600', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  plus: { fontSize: 18, color: COLORS.faint },
  emptyText: { padding: 20, textAlign: 'center', color: COLORS.muted, fontSize: 13 },
  addedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: { fontSize: 14, color: COLORS.text },
  noteInput: { borderWidth: 0, paddingHorizontal: 0, paddingVertical: 2, fontSize: 12, color: COLORS.muted, backgroundColor: 'transparent' },
  itemCost: { width: 78, textAlign: 'right', fontSize: 13, fontWeight: '600', color: COLORS.text },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: COLORS.bg,
  },
  emptyBox: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 40,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
    borderRadius: 10,
  },
  professionalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  summary: { backgroundColor: COLORS.bg, borderRadius: 10, padding: 16 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  summaryLabel: { fontSize: 13, color: COLORS.muted },
  summaryValue: { fontSize: 13, color: COLORS.text },
  summaryTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 10,
    marginTop: 6,
  },
  quickCreate: { gap: 10, padding: 12, borderRadius: 10, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border, marginBottom: 8 },
});
