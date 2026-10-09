import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { formatUnitCost, getCategoryLabel } from '../utils/costCalculations';
import InsumoModal, { CATEGORY_OPTIONS, describePackage } from './InsumoModal';
import { Button, CATEGORY_DOT, COLORS, confirmAction, Input, SectionHeader, Segmented, useIsWide } from './ui';

const FILTERS = [{ value: 'todos', label: 'Todos' }, ...CATEGORY_OPTIONS];

export default function InsumosPage() {
  const { insumos, procedures, saveInsumo, deleteInsumo } = useAnimaliaData();
  const isWide = useIsWide();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, insumo = edição

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
    return insumos
      .filter((insumo) => filterCategory === 'todos' || insumo.category === filterCategory)
      .filter((insumo) => !query || insumo.name.toLowerCase().includes(query) || (insumo.notes ?? '').toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }, [insumos, searchTerm, filterCategory]);

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
          <Segmented options={FILTERS} value={filterCategory} onChange={setFilterCategory} />
        </View>
        <Input placeholder="Buscar insumo" value={searchTerm} onChangeText={setSearchTerm} style={isWide && { width: 260 }} />
      </View>

      <Text style={styles.count}>{filtered.length} de {insumos.length} insumos</Text>

      <View style={styles.list}>
        {filtered.map((insumo) => {
          const count = usageCount.get(insumo.id) || 0;
          const pkg = describePackage(insumo);
          return (
            <View key={insumo.id} style={[styles.row, isWide && styles.rowWide]}>
              <View style={{ flex: 2, minWidth: 0 }}>
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
              <View style={[styles.costCol, isWide && { alignItems: 'flex-end' }]}>
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
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowWide: { flexDirection: 'row', alignItems: 'center' },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  notes: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  costCol: { flex: 1 },
  cost: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  unit: { fontWeight: '400', color: COLORS.faint },
  actions: { flexDirection: 'row', gap: 6 },
  empty: { padding: 32, textAlign: 'center', color: COLORS.muted },
});
