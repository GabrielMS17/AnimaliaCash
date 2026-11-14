import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  daysUntil,
  EXPIRING_DAYS,
  fetchMovements,
  formatDateBR,
  registerWriteOff,
  WRITE_OFF_REASONS,
} from '../services/stockService';
import { formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { PACKAGE_OPTIONS } from './InsumoModal';
import { AppModal, Button, COLORS, ErrorBanner, Field, Input, NumberInput, Select } from './ui';

const MOVEMENT_LABEL = { entrada: 'Entrada', consumo: 'Consumo', perda: 'Perda', ajuste: 'Ajuste' };

/** Lotes de um item (com validade e baixa manual) e as últimas movimentações. */
export default function StockItemModal({ insumo, entry, onClose, onChanged, onEntry }) {
  const [movements, setMovements] = useState(null);
  const [historyError, setHistoryError] = useState('');
  const [writeOff, setWriteOff] = useState(null); // lote em baixa

  const loadHistory = useCallback(() => fetchMovements(insumo.id).then(setMovements, (error) => setHistoryError(error.message)), [insumo.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const lots = entry?.lots ?? [];
  const { unit } = insumo;

  return (
    <AppModal
      title={insumo.name}
      subtitle={`Saldo disponível: ${formatDecimal(entry?.available ?? 0, 3)} ${unit}${entry?.averageCost ? ` · custo médio ${formatUnitCost(entry.averageCost)} / ${unit}` : ''}`}
      maxWidth={680}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Fechar" variant="secondary" onPress={onClose} />
          <Button label="+ Entrada de compra" onPress={onEntry} />
        </View>
      }
    >
      <Text style={styles.sectionTitle}>Lotes em estoque</Text>
      {lots.length === 0 ? (
        <Text style={styles.empty}>Nenhum lote com saldo. Use “Entrada de compra” para abastecer.</Text>
      ) : (
        <View style={styles.list}>
          {lots.map((lot) => {
            const days = daysUntil(lot.expiresAt);
            const expired = days !== null && days < 0;
            const expiring = days !== null && !expired && days <= EXPIRING_DAYS;
            const pkg = PACKAGE_OPTIONS.find((option) => option.value === lot.packageType)?.label;
            return (
              <View key={lot.id} style={styles.lotRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.lotTitle}>{lot.lotNumber ? `Lote ${lot.lotNumber}` : 'Sem número de lote'}</Text>
                  <Text style={[styles.meta, expired && styles.danger, expiring && styles.warning]}>
                    {lot.expiresAt
                      ? `${expired ? 'Venceu em' : 'Validade'} ${formatDateBR(lot.expiresAt)}${expiring ? ` (${days === 0 ? 'hoje' : `${days} dias`})` : ''}`
                      : 'Sem validade'}
                  </Text>
                  <Text style={styles.meta}>
                    Entrada em {formatDateBR(lot.createdAt)}
                    {pkg && lot.packages ? ` · ${formatDecimal(lot.packages, 3)} ${pkg.toLowerCase()} × ${formatDecimal(lot.unitsPerPackage, 3)} ${unit}` : ''}
                    {` · ${formatUnitCost(lot.unitCost)} / ${unit}`}
                  </Text>
                </View>
                <View style={styles.lotRight}>
                  <Text style={[styles.lotQty, expired && styles.danger]}>
                    {formatDecimal(lot.quantity, 3)} <Text style={styles.unit}>de {formatDecimal(lot.initialQuantity, 3)} {unit}</Text>
                  </Text>
                  <Button small variant="danger" label="Dar baixa" onPress={() => setWriteOff(lot)} />
                </View>
              </View>
            );
          })}
        </View>
      )}

      <Text style={styles.sectionTitle}>Últimas movimentações</Text>
      <ErrorBanner message={historyError} />
      {movements === null && !historyError ? <Text style={styles.empty}>Carregando…</Text> : null}
      {movements?.length === 0 ? <Text style={styles.empty}>Nenhuma movimentação ainda.</Text> : null}
      {movements?.length > 0 && (
        <View style={styles.list}>
          {movements.map((movement) => (
            <View key={movement.id} style={styles.moveRow}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.moveTitle}>
                  {MOVEMENT_LABEL[movement.type] ?? movement.type}
                  {movement.procedureName ? ` · ${movement.procedureName}` : ''}
                </Text>
                <Text style={styles.meta}>
                  {new Date(movement.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {movement.lotNumber ? ` · lote ${movement.lotNumber}` : ''}
                  {movement.notes ? ` · ${movement.notes}` : ''}
                </Text>
              </View>
              <Text style={[styles.moveQty, movement.quantity < 0 ? styles.danger : styles.positive]}>
                {movement.quantity > 0 ? '+' : ''}{formatDecimal(movement.quantity, 3)} {unit}
              </Text>
            </View>
          ))}
        </View>
      )}

      {writeOff && (
        <WriteOffModal
          lot={writeOff}
          unit={unit}
          onClose={() => setWriteOff(null)}
          onDone={() => {
            setWriteOff(null);
            onChanged();
            loadHistory();
          }}
        />
      )}
    </AppModal>
  );
}

function WriteOffModal({ lot, unit, onClose, onDone }) {
  const expired = (daysUntil(lot.expiresAt) ?? 0) < 0;
  const [quantity, setQuantity] = useState(lot.quantity);
  const [reason, setReason] = useState(expired ? 'Vencido' : 'Avaria / quebra');
  const [notes, setNotes] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!(quantity > 0)) return setErrorMsg('Informe a quantidade da baixa.');
    if (quantity > lot.quantity) return setErrorMsg(`O lote tem só ${formatDecimal(lot.quantity, 3)} ${unit}.`);
    setSaving(true);
    try {
      await registerWriteOff({
        lotId: lot.id,
        quantity,
        type: reason === 'Ajuste de inventário' ? 'ajuste' : 'perda',
        notes: [reason, notes.trim()].filter(Boolean).join(' — '),
      });
      onDone();
    } catch (error) {
      setErrorMsg(error.message);
      setSaving(false);
    }
  };

  return (
    <AppModal
      title="Dar baixa no lote"
      subtitle={`${lot.lotNumber ? `Lote ${lot.lotNumber}` : 'Lote sem número'} · ${formatDecimal(lot.quantity, 3)} ${unit} disponíveis`}
      maxWidth={460}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={saving ? 'Salvando…' : 'Confirmar baixa'} onPress={handleSave} disabled={saving} />
        </View>
      }
    >
      <ErrorBanner message={errorMsg} />
      <Field label="Motivo">
        <Select value={reason} options={WRITE_OFF_REASONS} onChange={setReason} />
      </Field>
      <Field label="Quantidade">
        <NumberInput min={0} value={quantity} onChange={setQuantity} suffix={unit} style={{ width: 180 }} />
      </Field>
      <Field label="Observação (opcional)">
        <Input placeholder="Ex: frasco quebrou na prateleira" value={notes} onChangeText={setNotes} />
      </Field>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  empty: { fontSize: 13, color: COLORS.muted },
  list: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  lotRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  lotTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  lotRight: { alignItems: 'flex-end', gap: 6 },
  lotQty: { fontSize: 15, fontWeight: '800', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  unit: { fontSize: 12, fontWeight: '400', color: COLORS.faint },
  danger: { color: COLORS.danger },
  warning: { color: COLORS.warning },
  positive: { color: '#047857' },
  moveRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  moveTitle: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  moveQty: { fontSize: 13, fontWeight: '700' },
});
