import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { consumeProcedure, fetchLots, isStockTracked, procedureStockItems, summarizeLots } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';
import { AppModal, Button, COLORS, ErrorBanner, Field, Input, NumberInput } from './ui';

/** Registra que um procedimento foi realizado e baixa do estoque os itens da ficha técnica. */
export default function ProcedureConsumeModal({ procedure, insumosMap, flushPending, onClose, onDone }) {
  const [times, setTimes] = useState(1);
  const [notes, setNotes] = useState('');
  const [stock, setStock] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLots()
      .then((lots) => active && setStock(summarizeLots(lots)))
      .catch((error) => active && setErrorMsg(error.message));
    return () => {
      active = false;
    };
  }, []);

  const items = useMemo(() => procedureStockItems(procedure, insumosMap, times), [procedure, insumosMap, times]);
  const untracked = useMemo(
    () => procedure.items.filter((item) => insumosMap.has(item.insumoId) && !isStockTracked(insumosMap.get(item.insumoId))),
    [procedure, insumosMap],
  );
  const missingInsumos = procedure.items.filter((item) => !insumosMap.has(item.insumoId)).length;

  const rows = items.map((item) => {
    const available = stock?.get(item.insumoId)?.available ?? 0;
    return { ...item, insumo: insumosMap.get(item.insumoId), available, short: stock !== null && available < item.quantity };
  });
  const hasShortage = rows.some((row) => row.short);

  const handleConfirm = async () => {
    if (!(times >= 1)) return setErrorMsg('Informe quantas vezes o procedimento foi realizado.');
    if (items.length === 0) return setErrorMsg('Este procedimento não tem itens com controle de estoque.');
    setSaving(true);
    setErrorMsg('');
    try {
      await flushPending();
      await consumeProcedure({ procedure, items, notes: notes.trim() });
      onDone(times);
    } catch (error) {
      if (error.missing) {
        const list = error.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ');
        setErrorMsg(`Estoque insuficiente, nada foi baixado. ${list}.`);
      } else {
        setErrorMsg(error.message);
      }
      setSaving(false);
    }
  };

  return (
    <AppModal
      title="Registrar realização"
      subtitle={`${procedure.name} — os itens abaixo serão baixados do estoque, começando pelos lotes que vencem primeiro.`}
      maxWidth={600}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            label={saving ? 'Registrando…' : 'Confirmar e baixar estoque'}
            onPress={handleConfirm}
            disabled={saving || stock === null || hasShortage || items.length === 0}
          />
        </View>
      }
    >
      <ErrorBanner message={errorMsg} />

      <View style={styles.inline}>
        <Field label="Quantas vezes foi realizado">
          <NumberInput min={1} value={times} onChange={(value) => setTimes(Math.max(1, Math.round(value)))} style={{ width: 120 }} />
        </Field>
        <Field label="Observação (opcional)" style={{ flex: 1, minWidth: 200 }}>
          <Input placeholder="Ex: paciente Thor, prontuário 123" value={notes} onChangeText={setNotes} />
        </Field>
      </View>

      <View style={styles.list}>
        <View style={[styles.row, styles.headRow]}>
          <Text style={[styles.head, { flex: 1 }]}>Item</Text>
          <Text style={[styles.head, styles.num]}>Gasta</Text>
          <Text style={[styles.head, styles.num]}>Em estoque</Text>
        </View>
        {rows.map((row) => (
          <View key={row.insumoId} style={styles.row}>
            <Text style={[styles.cell, { flex: 1 }]} numberOfLines={2}>{row.insumo?.name}</Text>
            <Text style={[styles.cell, styles.num]}>{formatDecimal(row.quantity, 3)} {row.insumo?.unit}</Text>
            <Text style={[styles.cell, styles.num, row.short && styles.danger]}>
              {stock === null ? '…' : `${formatDecimal(row.available, 3)} ${row.insumo?.unit}`}
            </Text>
          </View>
        ))}
        {rows.length === 0 && <Text style={styles.empty}>Nenhum item com controle de estoque nesta ficha.</Text>}
      </View>

      {hasShortage && (
        <Text style={styles.dangerText}>
          Falta estoque dos itens em vermelho. Dê entrada da compra no Estoque (ou ajuste a ficha) antes de registrar.
        </Text>
      )}
      {untracked.length > 0 && (
        <Text style={styles.note}>
          Não entram na baixa (sem controle de estoque): {untracked.map((item) => insumosMap.get(item.insumoId).name).join(', ')}.
        </Text>
      )}
      {missingInsumos > 0 && (
        <Text style={styles.note}>{missingInsumos} item(ns) da ficha não existem mais no estoque e foram ignorados.</Text>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  list: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  headRow: { backgroundColor: COLORS.bg },
  head: { fontSize: 11, fontWeight: '700', color: COLORS.muted, textTransform: 'uppercase' },
  cell: { fontSize: 13, color: COLORS.text },
  num: { width: 96, textAlign: 'right' },
  danger: { color: COLORS.danger, fontWeight: '700' },
  dangerText: { fontSize: 13, color: COLORS.danger },
  note: { fontSize: 12, color: COLORS.muted },
  empty: { padding: 16, textAlign: 'center', color: COLORS.muted },
});
