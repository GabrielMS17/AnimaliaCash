import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { appendAttendanceNote, concludeAttendance, todayISO } from '../services/attendanceService';
import { fetchLots, formatDateBR, maskDateBR, parseDateBR, procedureStockItems, summarizeLots } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';
import StockItemsEditor, { describeAdjustments, expectedMap, itemsToConsume } from './StockItemsEditor';
import { AppModal, Button, COLORS, ErrorBanner, Field, Input } from './ui';

/** Conclui um atendimento agendado: confere o que foi usado e baixa do estoque. */
export default function ConcludeAttendanceModal({ attendance, procedure, insumos, insumosMap, onClose, onDone }) {
  const today = todayISO();
  const times = attendance.quantidade || 1;
  const fichaItems = useMemo(() => (procedure ? procedureStockItems(procedure, insumosMap, times) : []), [procedure, insumosMap, times]);
  const expected = useMemo(() => expectedMap(fichaItems), [fichaItems]);
  const [dateText, setDateText] = useState(formatDateBR(attendance.data_realizacao <= today ? attendance.data_realizacao : today));
  const [items, setItems] = useState(fichaItems);
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

  const toConsume = itemsToConsume(items);
  const adjustments = describeAdjustments(toConsume, expected, insumosMap);
  const shortage = stock !== null && toConsume.some((item) => (stock.get(item.insumoId)?.available ?? 0) < item.quantity);

  const handleConfirm = async () => {
    let date = null;
    try {
      date = parseDateBR(dateText);
    } catch {
      date = null;
    }
    if (!date) return setErrorMsg('Informe a data no formato DD/MM/AAAA.');
    if (date > today) return setErrorMsg('A data de realização não pode ser futura.');
    setSaving(true);
    setErrorMsg('');
    try {
      await concludeAttendance({ id: attendance.id, date, items: toConsume });
      if (adjustments) {
        // A baixa já foi feita; se só a anotação falhar, não desfaz nada
        await appendAttendanceNote(attendance.id, attendance.observacao, `Ajuste na ficha: ${adjustments}`).catch(() => {});
      }
      onDone({ adjusted: Boolean(adjustments) });
    } catch (error) {
      setErrorMsg(error.missing
        ? `Estoque insuficiente, nada foi baixado. ${error.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ')}.`
        : error.message);
      setSaving(false);
    }
    return undefined;
  };

  return (
    <AppModal
      title="Concluir atendimento"
      subtitle={`${attendance.procedure_name}${times > 1 ? ` (${times}x)` : ''} — agendado para ${formatDateBR(attendance.data_realizacao)}${attendance.paciente ? ` · ${attendance.paciente}` : ''}.`}
      maxWidth={680}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={saving ? 'Concluindo…' : 'Concluir e baixar estoque'} onPress={handleConfirm} disabled={saving || stock === null || shortage} />
        </View>
      )}
    >
      <ErrorBanner message={errorMsg} />
      <Field label="Data em que foi realizado" hint="Entra no resultado do mês desta data." style={{ width: 200 }}>
        <Input value={dateText} onChangeText={(text) => setDateText(maskDateBR(text))} keyboardType="number-pad" placeholder="DD/MM/AAAA" maxLength={10} />
      </Field>
      {!procedure && <Text style={styles.warning}>A ficha deste procedimento não existe mais. Adicione abaixo os itens usados, se houver.</Text>}
      <View style={{ gap: 4 }}>
        <Text style={styles.title}>O que foi usado</Text>
        <Text style={styles.note}>Vem da ficha técnica. Ajuste se gastou mais, menos ou outro item.</Text>
      </View>
      <StockItemsEditor items={items} expected={expected} onChange={setItems} insumos={insumos} insumosMap={insumosMap} stock={stock} disabled={saving} />
      {adjustments ? <Text style={styles.note}>Ajuste em relação à ficha: {adjustments}.</Text> : null}
      {shortage && <Text style={styles.danger}>Falta estoque dos itens em vermelho.</Text>}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  title: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  note: { fontSize: 12, color: COLORS.muted },
  warning: { fontSize: 13, color: COLORS.warning },
  danger: { fontSize: 13, color: COLORS.danger },
});
