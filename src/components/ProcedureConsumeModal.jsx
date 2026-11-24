import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { registerAttendance, todayISO } from '../services/attendanceService';
import { fetchBcbMdr } from '../services/bcbTaxas';
import { PAYMENT_FORMS, resolveFees } from '../services/monthlyResult';
import { fetchLots, formatDateBR, isStockTracked, maskDateBR, parseDateBR, procedureStockItems, summarizeLots } from '../services/stockService';
import { supabase } from '../supabase';
import { calculateCommission, calculateProcedure, formatBRL, formatDecimal } from '../utils/costCalculations';
import StockItemsEditor, { describeAdjustments, expectedMap, itemsToConsume } from './StockItemsEditor';
import { AppModal, Button, COLORS, ErrorBanner, Field, Input, NumberInput, Segmented, Select } from './ui';

const STATUS_OPTIONS = [
  { value: 'realizado', label: 'Já foi realizado' },
  { value: 'agendado', label: 'Agendado' },
];
const FORM_OPTIONS = [{ value: '', label: 'Não informada' }, ...PAYMENT_FORMS.map((item) => ({ value: item.forma, label: item.label }))];
const CATEGORY_LABEL = { cirurgia: 'Cirurgia', internacao: 'Internação', banho_tosa: 'Banho & Tosa' };

/** "31/12/2026" -> "2026-12-31"; null se a data estiver incompleta ou inválida. */
function toISODate(text) {
  try {
    return parseDateBR(text);
  } catch {
    return null;
  }
}

/**
 * Registra um atendimento: quando aconteceu (ou quando vai acontecer), quanto foi cobrado, como foi pago
 * e o que foi realmente gasto. Se já foi realizado, baixa do estoque na mesma operação.
 * Sem `procedure`, mostra uma busca para escolher o procedimento entre `procedures`.
 */
export default function ProcedureConsumeModal({
  procedure: initialProcedure, procedures = [], insumos = [], insumosMap, settings, flushPending, onClose, onDone,
}) {
  const today = todayISO();
  const priceOf = (p) => {
    if (!p) return 0;
    const { breakdown } = calculateProcedure(p, insumosMap, settings);
    return p.suggestedPrice > 0 ? p.suggestedPrice : breakdown.suggestedPriceByMargin;
  };
  const [procedure, setProcedure] = useState(initialProcedure ?? null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('realizado');
  const [dateText, setDateText] = useState(formatDateBR(today));
  const [times, setTimes] = useState(1);
  const [value, setValue] = useState(() => Number(priceOf(initialProcedure).toFixed(2)));
  const [valueTouched, setValueTouched] = useState(false);
  const [form, setForm] = useState('');
  const [patient, setPatient] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState(() => (initialProcedure ? procedureStockItems(initialProcedure, insumosMap, 1) : []));
  const [itemsTouched, setItemsTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [stock, setStock] = useState(null);
  const [clinicFees, setClinicFees] = useState([]);
  const [bcb, setBcb] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const previousTimes = useRef(1);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetchLots()
      .then((lots) => active && setStock(summarizeLots(lots)))
      .catch((error) => active && setErrorMsg(error.message));
    supabase.from('taxas_pagamento').select('bandeira, forma, taxa')
      .then(({ data }) => active && setClinicFees(data ?? []));
    fetchBcbMdr({ signal: controller.signal })
      .then((result) => active && setBcb(result.rates))
      .catch(() => {});
    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  const unitPrice = priceOf(procedure);

  const fichaItems = useMemo(() => (procedure ? procedureStockItems(procedure, insumosMap, times) : []), [procedure, insumosMap, times]);
  const expected = useMemo(() => expectedMap(fichaItems), [fichaItems]);

  // Ao escolher o procedimento na lista: itens da ficha e preço dela
  const pickProcedure = (picked) => {
    setProcedure(picked);
    setItems(procedureStockItems(picked, insumosMap, times));
    setItemsTouched(false);
    if (!valueTouched) setValue(Number((priceOf(picked) * times).toFixed(2)));
  };

  const date = toISODate(dateText);
  const isFuture = Boolean(date && date > today);
  const effectiveStatus = isFuture ? 'agendado' : status;
  const realized = effectiveStatus === 'realizado';

  const fees = useMemo(() => resolveFees(clinicFees, bcb), [clinicFees, bcb]);
  const formKey = PAYMENT_FORMS.find((item) => item.forma === form)?.key;
  const fee = formKey ? fees[formKey] : null;
  const feePercent = fee && fee.source !== 'sem taxa' ? fee.used : null;

  // Comissão do profissional sobre o valor cobrado neste atendimento
  const commissionBreakdown = procedure ? calculateProcedure(procedure, insumosMap, settings).breakdown : undefined;
  const commission = calculateCommission(commissionBreakdown, value, times);
  const commissionDetail = commissionBreakdown?.vetCommissionFixed > 0
    ? `valor fixo de ${formatBRL(commissionBreakdown.vetCommissionFixed)}${times > 1 ? ` × ${times}` : ''}`
    : `${formatDecimal(commissionBreakdown?.vetCommissionPercent ?? 0)}% de ${formatBRL(value)}`;

  const toConsume = itemsToConsume(items);
  const adjustments = procedure ? describeAdjustments(toConsume, expected, insumosMap) : '';
  const shortage = realized && stock !== null && toConsume.some((item) => (stock.get(item.insumoId)?.available ?? 0) < item.quantity);
  const untracked = procedure ? procedure.items.filter((item) => insumosMap.has(item.insumoId) && !isStockTracked(insumosMap.get(item.insumoId))) : [];

  const changeTimes = (next) => {
    const count = Math.max(1, Math.round(next));
    const factor = count / previousTimes.current;
    previousTimes.current = count;
    setTimes(count);
    if (!valueTouched) setValue(Number((unitPrice * count).toFixed(2)));
    // Itens ajustados acompanham a proporção; sem ajuste, seguem a ficha
    setItems((current) => (itemsTouched
      ? current.map((item) => ({ ...item, quantity: Number((item.quantity * factor).toFixed(3)) }))
      : procedureStockItems(procedure, insumosMap, count)));
  };

  const pickable = useMemo(() => {
    const query = search.trim().toLowerCase();
    return procedures
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.targetWeightKg ?? 0) - (b.targetWeightKg ?? 0));
  }, [procedures, search]);

  const handleConfirm = async () => {
    if (!date) return setErrorMsg('Informe a data no formato DD/MM/AAAA.');
    if (!(value >= 0)) return setErrorMsg('Informe o valor cobrado (pode ser zero).');
    setSaving(true);
    setErrorMsg('');
    const adjustmentNote = realized && adjustments ? `Ajuste na ficha: ${adjustments}${reason.trim() ? ` (${reason.trim()})` : ''}` : '';
    try {
      await flushPending();
      await registerAttendance({
        procedure,
        date,
        status: effectiveStatus,
        times,
        value,
        form,
        feePercent,
        patient: patient.trim(),
        notes: [notes.trim(), adjustmentNote].filter(Boolean).join(' | '),
        items: toConsume,
      });
      onDone({ procedure, times, status: effectiveStatus, date, adjusted: realized && Boolean(adjustments) });
    } catch (error) {
      if (error.missing) {
        const list = error.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ');
        setErrorMsg(`Estoque insuficiente, nada foi registrado. ${list}.`);
      } else {
        setErrorMsg(error.message);
      }
      setSaving(false);
    }
    return undefined;
  };

  // Etapa 1 (botão "Novo atendimento"): escolher o procedimento
  if (!procedure) {
    return (
      <AppModal title="Novo atendimento" subtitle="Escolha o procedimento realizado ou agendado." maxWidth={600} onClose={onClose}>
        <Input placeholder="Buscar procedimento (ex: castração)" value={search} onChangeText={setSearch} autoFocus />
        <View style={styles.pickList}>
          {pickable.map((p) => (
            <Pressable key={p.id} onPress={() => pickProcedure(p)} style={({ pressed }) => [styles.pickItem, pressed && { backgroundColor: COLORS.bg }]}>
              <Text style={styles.pickName}>{p.name}</Text>
              <Text style={styles.pickMeta}>{CATEGORY_LABEL[p.category] ?? ''}{p.targetWeightKg ? ` · ${p.targetWeightKg} kg` : ''}</Text>
            </Pressable>
          ))}
          {pickable.length === 0 && <Text style={styles.empty}>Nenhum procedimento encontrado.</Text>}
        </View>
      </AppModal>
    );
  }

  return (
    <AppModal
      title="Registrar atendimento"
      subtitle={realized
        ? `${procedure.name} — entra no resultado do mês da data abaixo e baixa do estoque o que foi usado (lotes que vencem primeiro).`
        : `${procedure.name} — fica na agenda e entra na previsão do mês. O estoque só é baixado quando for concluído.`}
      maxWidth={680}
      onClose={onClose}
      footer={(
        <View style={styles.footer}>
          {!initialProcedure && <Button variant="ghost" label="← Trocar procedimento" onPress={() => setProcedure(null)} disabled={saving} />}
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button
            label={saving ? 'Registrando…' : realized ? (toConsume.length > 0 ? 'Registrar e baixar estoque' : 'Registrar atendimento') : 'Agendar'}
            onPress={handleConfirm}
            disabled={saving || (realized && (stock === null || shortage))}
          />
        </View>
      )}
    >
      <ErrorBanner message={errorMsg} />

      <Field label="Situação">
        <Segmented options={STATUS_OPTIONS} value={effectiveStatus} onChange={setStatus} />
      </Field>

      <View style={styles.inline}>
        <Field
          label="Data"
          hint={!date ? 'DD/MM/AAAA' : isFuture ? 'Data futura: fica como agendado.' : realized ? 'Pode ser uma data passada.' : 'Dia marcado.'}
          style={{ width: 150 }}
        >
          <Input value={dateText} onChangeText={(text) => setDateText(maskDateBR(text))} keyboardType="number-pad" placeholder="DD/MM/AAAA" maxLength={10} />
        </Field>
        <Field label="Quantas vezes" style={{ width: 120 }}>
          <NumberInput min={1} value={times} onChange={changeTimes} />
        </Field>
        <Field label="Valor cobrado" hint={`${procedure.suggestedPrice > 0 ? 'Preço da ficha' : 'Preço sugerido'}: ${formatBRL(unitPrice)}${times > 1 ? ` × ${times}` : ''}`} style={{ flex: 1, minWidth: 170 }}>
          <NumberInput min={0} prefix="R$" value={value} onChange={(next) => { setValueTouched(true); setValue(next); }} />
        </Field>
      </View>

      <Field
        label="Forma de pagamento"
        hint={fee && feePercent != null ? `Taxa ${formatDecimal(feePercent, 2)}% (${fee.source === 'clínica' ? 'cadastrada pela clínica' : 'média do Banco Central'})` : realized ? 'Opcional' : 'Pode deixar para depois'}
      >
        <Select value={form} options={FORM_OPTIONS} onChange={setForm} />
      </Field>

      <View style={styles.commission}>
        <View style={{ flex: 1 }}>
          <Text style={styles.commissionLabel}>Comissão do profissional{procedure.vetCommissionRole ? ` (${procedure.vetCommissionRole})` : ''}</Text>
          <Text style={styles.note}>{commissionDetail}</Text>
        </View>
        <Text style={styles.commissionValue}>{formatBRL(commission)}</Text>
      </View>

      <View style={styles.inline}>
        <Field label="Paciente (opcional)" style={{ flex: 1, minWidth: 180 }}>
          <Input placeholder="Ex: Thor (tutor Ana)" value={patient} onChangeText={setPatient} />
        </Field>
        <Field label="Observação (opcional)" style={{ flex: 1, minWidth: 180 }}>
          <Input placeholder="Ex: prontuário 123" value={notes} onChangeText={setNotes} />
        </Field>
      </View>

      {realized ? (
        <>
          <View style={styles.itemsHead}>
            <Text style={styles.itemsTitle}>O que foi usado</Text>
            <Text style={styles.note}>Vem da ficha técnica. Ajuste se gastou mais, menos ou outro item — a ficha não é alterada.</Text>
            {itemsTouched && (
              <Button small variant="ghost" label="Voltar para a ficha" onPress={() => { setItems(fichaItems); setItemsTouched(false); setReason(''); }} />
            )}
          </View>
          <StockItemsEditor
            items={items}
            expected={expected}
            onChange={(next) => { setItems(next); setItemsTouched(true); }}
            insumos={insumos}
            insumosMap={insumosMap}
            stock={stock}
            disabled={saving}
          />
          {adjustments ? (
            <Field label="Motivo do ajuste (opcional)" hint={`Fica registrado no atendimento: ${adjustments}`}>
              <Input placeholder="Ex: intercorrência, paciente maior que o previsto" value={reason} onChangeText={setReason} />
            </Field>
          ) : null}
          {shortage && (
            <Text style={styles.dangerText}>Falta estoque dos itens em vermelho. Dê entrada da compra no Estoque (ou ajuste as quantidades) antes de registrar.</Text>
          )}
          {untracked.length > 0 && (
            <Text style={styles.note}>Não entram na baixa (sem controle de estoque): {untracked.map((item) => insumosMap.get(item.insumoId).name).join(', ')}.</Text>
          )}
        </>
      ) : (
        <Text style={styles.note}>Os agendados aparecem na aba Atendimentos, onde podem ser concluídos (aí você confere o que foi usado e o estoque é baixado) ou cancelados.</Text>
      )}
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  inline: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  commission: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: 8, backgroundColor: COLORS.bg, borderWidth: 1, borderColor: COLORS.border },
  commissionLabel: { fontSize: 13, fontWeight: '600', color: COLORS.textSoft },
  commissionValue: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  itemsHead: { gap: 4 },
  itemsTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  dangerText: { fontSize: 13, color: COLORS.danger },
  note: { fontSize: 12, color: COLORS.muted },
  pickList: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  pickItem: { paddingHorizontal: 14, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: '#F1F5F9', gap: 2 },
  pickName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  pickMeta: { fontSize: 12, color: COLORS.muted },
  empty: { padding: 16, textAlign: 'center', color: COLORS.muted },
});
