import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { formatUnitCost, getCategoryLabel } from '../utils/costCalculations';
import { VETERINARIAN_ROLE } from '../utils/accessControl';
import InsumoModal, { CATEGORY_OPTIONS, describePackage } from './InsumoModal';
import { Button, CATEGORY_DOT, COLORS, confirmAction, Input, SectionHeader, Segmented, useIsWide } from './ui';

export default function InsumosPage() {
  const { insumos, procedures, saveInsumo, deleteInsumo, role } = useAnimaliaData();
  const isWide = useIsWide();
  const isVeterinarian = role === VETERINARIAN_ROLE;
  const categoryOptions = isVeterinarian
    ? CATEGORY_OPTIONS.filter((option) => option.value !== 'banho_tosa')
    : CATEGORY_OPTIONS;
  const filterOptions = [{ value: 'todos', label: 'Todos' }, ...categoryOptions];
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, insumo = edição

  const availableInsumos = useMemo(
    () => isVeterinarian ? insumos.filter((insumo) => insumo.category !== 'banho_tosa') : insumos,
    [insumos, isVeterinarian],
  );
  const activeFilterCategory = isVeterinarian && filterCategory === 'banho_tosa' ? 'todos' : filterCategory;

  // Quantos procedimentos usam cada insumo
  const usageCount = useMemo(() => {
    const map = new Map();
    procedures.forEach((procedure) => {
      new Set(procedure.items.map((item) => item.insumoId)).forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });
    return map;
  }, [procedures]);

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return availableInsumos
      .filter((insumo) => activeFilterCategory === 'todos' || insumo.category === activeFilterCategory)
      .filter((insumo) => !query || insumo.name.toLowerCase().includes(query) || (insumo.notes ?? '').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [availableInsumos, searchTerm, activeFilterCategory]);

  const handleDelete = async (insumo) => {
    const count = usageCount.get(insumo.id) || 0;
    const message = count > 0
      ? `"${insumo.name}" é usado em ${count} procedimento(s). Deseja realmente excluí-lo?`
      : `Deseja excluir "${insumo.name}"?`;
    if (await confirmAction(message, 'Excluir')) deleteInsumo(insumo.id);
  };

  return (
    <View>
      <SectionHeader
        title="Insumos"
        description="Materiais e medicamentos com custo unitário. Alterar um custo recalcula todos os procedimentos que o utilizam."
        action={<Button label="+ Novo insumo" onPress={() => setEditing({})} />}
      />

      <View style={[styles.filters, isWide && styles.filtersWide]}>
        <View style={{ flexShrink: 1 }}>
          <Segmented options={filterOptions} value={activeFilterCategory} onChange={setFilterCategory} wrap />
        </View>
        <Input placeholder="Buscar insumo" value={searchTerm} onChangeText={setSearchTerm} style={isWide && { width: 260 }} />
      </View>

      <Text style={styles.count}>{filtered.length} de {availableInsumos.length} insumos</Text>

      <View style={styles.list}>
        {filtered.map((insumo) => {
          const count = usageCount.get(insumo.id) || 0;
          const pkg = describePackage(insumo);
          return (
            <View key={insumo.id} style={[styles.row, isWide && styles.rowWide]}>
              <View style={[styles.infoCol, isWide && styles.infoColWide]}>
                <Text style={styles.name}>{insumo.name}</Text>
                {insumo.notes ? <Text style={styles.notes}>{insumo.notes}</Text> : null}
                <View style={styles.categoryRow}>
                  <View style={[styles.dot, { backgroundColor: CATEGORY_DOT[insumo.category] ?? COLORS.faint }]} />
                  <Text style={styles.notes}>{getCategoryLabel(insumo.category)}</Text>
                  <Text style={styles.notes}>
                    · {count === 0 ? 'não usado' : `usado em ${count} ${count === 1 ? 'procedimento' : 'procedimentos'}`}
                  </Text>
                </View>
              </View>
              <View style={[styles.costCol, isWide && styles.costColWide]}>
                <Text style={styles.cost}>
                  {formatUnitCost(insumo.costPerUnit)}
                  <Text style={styles.unit}> / {insumo.unit}</Text>
                </Text>
                {pkg ? <Text style={styles.notes}>{pkg}</Text> : null}
              </View>
              <View style={styles.actions}>
                <Button small variant="secondary" label="Editar" onPress={() => setEditing(insumo)} />
                <Button small variant="danger" label="Excluir" onPress={() => handleDelete(insumo)} />
              </View>
            </View>
          );
        })}
        {filtered.length === 0 && <Text style={styles.empty}>Nenhum insumo encontrado.</Text>}
      </View>

      {editing && (
        <InsumoModal
          insumo={editing.id ? editing : null}
          categoryOptions={categoryOptions}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            saveInsumo(saved);
            setEditing(null);
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 10, marginBottom: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 10 },
  list: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowWide: { flexDirection: 'row', alignItems: 'center' },
  infoCol: { minWidth: 0 },
  infoColWide: { flex: 2 },
  costCol: { alignItems: 'flex-start', minWidth: 0 },
  costColWide: { flex: 1, alignItems: 'flex-end' },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  notes: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  cost: { fontSize: 14, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  unit: { fontWeight: '400', color: COLORS.faint },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  empty: { padding: 32, textAlign: 'center', color: COLORS.muted },
});
