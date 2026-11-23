import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isStockTracked } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';
import { Button, COLORS, NumberInput, Select } from './ui';

/**
 * Lista editável dos itens baixados do estoque num atendimento.
 * Começa com a ficha técnica; dá para mudar quantidades, retirar itens e adicionar outros do estoque.
 * items: [{ insumoId, quantity }]; expected: Map(insumoId -> quantidade da ficha).
 */
export default function StockItemsEditor({ items, expected, onChange, insumos, insumosMap, stock, disabled = false }) {
  const available = (insumoId) => stock?.get(insumoId)?.available ?? 0;
  const addable = useMemo(() => insumos
    .filter((insumo) => isStockTracked(insumo) && !expected.has(insumo.id) && !items.some((item) => item.insumoId === insumo.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
    .map((insumo) => ({ value: insumo.id, label: `${insumo.name} (${insumo.unit})` })), [insumos, items, expected]);

  // Itens da ficha que foram retirados continuam visíveis (riscados) para dar para devolver
  const removed = [...expected.keys()].filter((id) => !items.some((item) => item.insumoId === id));

  const setQuantity = (insumoId, quantity) => onChange(items.map((item) => (item.insumoId === insumoId ? { ...item, quantity } : item)));
  const remove = (insumoId) => onChange(items.filter((item) => item.insumoId !== insumoId));
  const restore = (insumoId) => onChange([...items, { insumoId, quantity: expected.get(insumoId) }]);
  const add = (insumoId) => insumoId && onChange([...items, { insumoId, quantity: 1 }]);

  return (
    <View style={styles.wrap}>
      <View style={styles.list}>
        {items.map((item) => {
          const insumo = insumosMap.get(item.insumoId);
          const base = expected.get(item.insumoId);
          const changed = base === undefined ? 'added' : Math.abs(base - item.quantity) > 1e-9 ? 'changed' : '';
          const short = stock !== null && available(item.insumoId) < item.quantity;
          return (
            <View key={item.insumoId} style={styles.row}>
              <View style={styles.info}>
                <Text style={styles.name} numberOfLines={2}>{insumo?.name ?? item.insumoId}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>Ficha: {base === undefined ? '—' : formatDecimal(base, 3)}</Text>
                  <Text style={[styles.meta, short && styles.danger]}>
                    Estoque: {stock === null ? '…' : `${formatDecimal(available(item.insumoId), 3)} ${insumo?.unit ?? ''}`}
                  </Text>
                  {changed === 'added' && <Text style={[styles.tag, styles.tagAdded]}>adicionado</Text>}
                  {changed === 'changed' && <Text style={styles.tag}>ajustado</Text>}
                </View>
              </View>
              <NumberInput
                min={0}
                value={item.quantity}
                suffix={insumo?.unit}
                onChange={(value) => setQuantity(item.insumoId, value)}
                style={styles.qty}
              />
              <Button small variant="ghost" label="Retirar" onPress={() => remove(item.insumoId)} disabled={disabled} />
            </View>
          );
        })}
        {removed.map((insumoId) => (
          <View key={`removed-${insumoId}`} style={[styles.row, styles.removedRow]}>
            <View style={styles.info}>
              <Text style={[styles.name, styles.struck]} numberOfLines={2}>{insumosMap.get(insumoId)?.name}</Text>
              <View style={styles.metaRow}>
                <Text style={styles.meta}>Ficha: {formatDecimal(expected.get(insumoId), 3)}</Text>
                <Text style={[styles.tag, styles.tagRemoved]}>não usado</Text>
              </View>
            </View>
            <Button small variant="ghost" label="Devolver" onPress={() => restore(insumoId)} disabled={disabled} />
          </View>
        ))}
        {items.length === 0 && removed.length === 0 && (
          <Text style={styles.empty}>Nenhum item com controle de estoque nesta ficha.</Text>
        )}
      </View>
      {addable.length > 0 && (
        <Select value={null} options={addable} onChange={add} placeholder="+ Adicionar insumo que não está na ficha…" />
      )}
    </View>
  );
}

/** Itens da ficha como Map(insumoId -> quantidade), já multiplicados pelo número de vezes. */
export function expectedMap(items) {
  return new Map(items.map((item) => [item.insumoId, item.quantity]));
}

/** Diferenças em relação à ficha, em texto curto (vai para a observação do atendimento). */
export function describeAdjustments(items, expected, insumosMap) {
  const parts = [];
  items.forEach((item) => {
    const name = insumosMap.get(item.insumoId)?.name ?? item.insumoId;
    const base = expected.get(item.insumoId);
    if (base === undefined) parts.push(`+${name} ${formatDecimal(item.quantity, 3)}`);
    else if (Math.abs(base - item.quantity) > 1e-9) parts.push(`${name} ${formatDecimal(base, 3)}→${formatDecimal(item.quantity, 3)}`);
  });
  expected.forEach((_, insumoId) => {
    if (!items.some((item) => item.insumoId === insumoId)) parts.push(`sem ${insumosMap.get(insumoId)?.name ?? insumoId}`);
  });
  return parts.join('; ');
}

/** Itens válidos para mandar ao banco (quantidade > 0). */
export function itemsToConsume(items) {
  return items
    .filter((item) => item.quantity > 0)
    .map((item) => ({ insumoId: item.insumoId, quantity: Number(item.quantity.toFixed(3)) }));
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  list: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  removedRow: { backgroundColor: COLORS.bg },
  info: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 13, color: COLORS.text, fontWeight: '600' },
  struck: { textDecorationLine: 'line-through', color: COLORS.faint },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 4, columnGap: 10 },
  meta: { fontSize: 11, color: COLORS.muted },
  danger: { color: COLORS.danger, fontWeight: '700' },
  tag: {
    fontSize: 10,
    fontWeight: '700',
    color: '#B45309',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 999,
    overflow: 'hidden',
  },
  tagAdded: { color: '#1D4ED8', backgroundColor: '#EFF6FF' },
  tagRemoved: { color: COLORS.muted, backgroundColor: '#F1F5F9' },
  qty: { width: 116 },
  empty: { padding: 16, textAlign: 'center', color: COLORS.muted },
});
