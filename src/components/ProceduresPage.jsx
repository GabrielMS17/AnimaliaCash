import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { calculateProcedure, formatBRL, formatDuration, matchesWeightRange, WEIGHT_RANGES } from '../utils/costCalculations';
import ProcedureDetailModal from './ProcedureDetailModal';
import ProcedureEditModal from './ProcedureEditModal';
import { Button, COLORS, confirmAction, Input, SECTIONS, SectionHeader, Segmented, useAccent, useIsWide } from './ui';

const CATEGORY_HEADER = {
  banho_tosa: { description: 'Custo de cada serviço por porte do animal.', newLabel: 'Novo banho & tosa' },
  cirurgia: {
    description: 'Custo de cada cirurgia por peso do paciente, incluindo os profissionais terceirizados.',
    newLabel: 'Nova cirurgia',
  },
  internacao: { description: 'Custo das diárias de internação por porte do animal.', newLabel: 'Nova diária' },
};

const WEIGHT_OPTIONS = WEIGHT_RANGES.map((range) => ({ value: range.id, label: range.label }));

/** Página de Cirurgias, Internação ou Banho & Tosa: lista, filtros e cadastro de procedimentos. */
export default function ProceduresPage({ category }) {
  const { procedures, insumos, insumosMap, settings, saveProcedure, duplicateProcedure, deleteProcedure, saveInsumo } = useAnimaliaData();
  const isWide = useIsWide();
  const { width } = useWindowDimensions();
  const columns = width >= 1100 ? 3 : width >= 680 ? 2 : 1;

  const [searchTerm, setSearchTerm] = useState('');
  const [weightRange, setWeightRange] = useState('todos');
  const [detailProcedure, setDetailProcedure] = useState(null);
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, procedimento = edição

  const header = CATEGORY_HEADER[category];
  const categoryProcedures = useMemo(() => procedures.filter((procedure) => procedure.category === category), [procedures, category]);

  const visible = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return categoryProcedures
      .filter((procedure) => matchesWeightRange(procedure.targetWeightKg, weightRange))
      .filter((procedure) => !query || procedure.name.toLowerCase().includes(query) || procedure.description.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.targetWeightKg ?? 0) - (b.targetWeightKg ?? 0));
  }, [categoryProcedures, searchTerm, weightRange]);

  const isFiltering = weightRange !== 'todos' || searchTerm.trim() !== '';

  const handleDelete = async (procedure) => {
    if (await confirmAction(`Remover "${procedure.name}"?`, 'Remover')) {
      deleteProcedure(procedure.id);
      if (detailProcedure?.id === procedure.id) setDetailProcedure(null);
    }
  };

  return (
    <View>
      <SectionHeader
        title={SECTIONS[category].label}
        description={header.description}
        action={<Button label={`+ ${header.newLabel}`} onPress={() => setEditing({})} />}
      />

      <View style={[styles.filters, isWide && styles.filtersWide]}>
        <View style={{ flexShrink: 1 }}>
          <Segmented options={WEIGHT_OPTIONS} value={weightRange} onChange={setWeightRange} />
        </View>
        <Input placeholder="Buscar procedimento" value={searchTerm} onChangeText={setSearchTerm} style={isWide && { width: 260 }} />
      </View>

      {visible.length > 0 ? (
        <>
          <Text style={styles.count}>{visible.length} de {categoryProcedures.length} procedimentos</Text>
          <View style={styles.grid}>
            {visible.map((procedure) => (
              <View key={procedure.id} style={{ width: `${100 / columns}%`, padding: 6 }}>
                <ProcedureCard
                  procedure={procedure}
                  insumosMap={insumosMap}
                  settings={settings}
                  onOpen={() => setDetailProcedure(procedure)}
                  onEdit={() => setEditing(procedure)}
                  onDuplicate={() => duplicateProcedure(procedure)}
                  onDelete={() => handleDelete(procedure)}
                />
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {isFiltering ? 'Nenhum procedimento encontrado.' : 'Nenhum procedimento cadastrado ainda.'}
          </Text>
          <Text style={styles.count}>
            {isFiltering ? 'Tente outra faixa de peso ou outro termo de busca.' : `Toque em "${header.newLabel}" para começar.`}
          </Text>
          {isFiltering && (
            <Button
              variant="ghost"
              label="Limpar filtros"
              onPress={() => {
                setWeightRange('todos');
                setSearchTerm('');
              }}
            />
          )}
        </View>
      )}

      {detailProcedure && (
        <ProcedureDetailModal
          procedure={detailProcedure}
          insumosMap={insumosMap}
          settings={settings}
          onClose={() => setDetailProcedure(null)}
          onEdit={(procedure) => {
            setDetailProcedure(null);
            setEditing(procedure);
          }}
        />
      )}

      {editing && (
        <ProcedureEditModal
          procedure={editing.id ? editing : null}
          defaultCategory={category}
          insumos={insumos}
          insumosMap={insumosMap}
          settings={settings}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            saveProcedure(saved);
            setEditing(null);
          }}
          onQuickCreateInsumo={saveInsumo}
        />
      )}
    </View>
  );
}

function ProcedureCard({ procedure, insumosMap, settings, onOpen, onEdit, onDuplicate, onDelete }) {
  const accent = useAccent();
  const calc = calculateProcedure(procedure, insumosMap, settings);
  const hasMissingItems = calc.itemDetails.some((item) => item.missing);

  const meta = [
    procedure.targetWeightKg ? `${procedure.targetWeightKg} kg` : null,
    formatDuration(procedure.durationMinutes, procedure.category),
    `${procedure.items.length} ${procedure.items.length === 1 ? 'insumo' : 'insumos'}`,
  ].filter(Boolean);

  return (
    <View style={[styles.card, { borderTopColor: accent.accent }]}>
      <Pressable onPress={onOpen} style={({ pressed }) => [styles.cardBody, pressed && { opacity: 0.7 }]}>
        <Text style={styles.cardTitle} numberOfLines={2}>{procedure.name}</Text>
        <Text style={styles.meta}>{meta.join(' · ')}</Text>
        <View style={styles.cardFooter}>
          <View>
            <Text style={styles.costLabel}>Custo total</Text>
            <Text style={styles.cost}>{formatBRL(calc.breakdown.totalCost)}</Text>
          </View>
          {hasMissingItems && <Text style={styles.warning}>⚠ Revisar insumos</Text>}
        </View>
      </Pressable>
      <View style={styles.cardActions}>
        <Button small variant="ghost" label="Editar" onPress={onEdit} />
        <Button small variant="ghost" label="Duplicar" onPress={onDuplicate} />
        <Button small variant="ghost" label="Excluir" onPress={onDelete} style={{ marginLeft: 'auto' }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 10, marginBottom: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 6 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  card: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderTopWidth: 3,
    overflow: 'hidden',
  },
  cardBody: { padding: 16, flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '700', color: COLORS.text, lineHeight: 20 },
  meta: { fontSize: 13, color: COLORS.muted, marginTop: 4 },
  cardFooter: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 18, gap: 8 },
  costLabel: { fontSize: 12, color: COLORS.muted },
  cost: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  warning: { fontSize: 12, color: COLORS.warning },
  cardActions: {
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 6,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: COLORS.borderStrong,
  },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textSoft },
});
