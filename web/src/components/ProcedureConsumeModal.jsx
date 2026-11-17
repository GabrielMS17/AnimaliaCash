import { useEffect, useMemo, useState } from 'react';
import { registerAttendance, todayISO } from '../services/attendanceService';
import { fetchBcbMdr } from '../services/bcbTaxas';
import { PAYMENT_FORMS, resolveFees } from '../services/monthlyResult';
import { fetchLots, isStockTracked, procedureStockItems, summarizeLots } from '../services/stockService';
import { supabase } from '../supabase';
import { calculateProcedure, formatBRL, formatDecimal } from '../utils/costCalculations';
import { Field, Modal, NumberInput, Segmented } from './ui';

const STATUS_OPTIONS = [
  { value: 'realizado', label: 'Já foi realizado' },
  { value: 'agendado', label: 'Agendado' },
];

/**
 * Registra um atendimento: quando aconteceu (ou quando vai acontecer), quanto foi cobrado e como foi pago.
 * Se já foi realizado, baixa do estoque os itens da ficha técnica na mesma operação.
 */
export default function ProcedureConsumeModal({ procedure, insumosMap, settings, flushPending, onClose, onDone }) {
  const today = todayISO();
  const unitPrice = useMemo(() => {
    const { breakdown } = calculateProcedure(procedure, insumosMap, settings);
    return procedure.suggestedPrice > 0 ? procedure.suggestedPrice : breakdown.suggestedPriceByMargin;
  }, [procedure, insumosMap, settings]);

  const [status, setStatus] = useState('realizado');
  const [date, setDate] = useState(today);
  const [times, setTimes] = useState(1);
  const [value, setValue] = useState(Number(unitPrice.toFixed(2)));
  const [valueTouched, setValueTouched] = useState(false);
  const [form, setForm] = useState('');
  const [patient, setPatient] = useState('');
  const [notes, setNotes] = useState('');
  const [stock, setStock] = useState(null);
  const [clinicFees, setClinicFees] = useState([]);
  const [bcb, setBcb] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetchLots()
      .then((lots) => active && setStock(summarizeLots(lots)))
      .catch((loadError) => active && setError(loadError.message));
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

  // Data futura só pode ser agendamento
  const isFuture = date > today;
  const effectiveStatus = isFuture ? 'agendado' : status;
  const realized = effectiveStatus === 'realizado';

  const fees = useMemo(() => resolveFees(clinicFees, bcb), [clinicFees, bcb]);
  const formKey = PAYMENT_FORMS.find((item) => item.forma === form)?.key;
  const fee = formKey ? fees[formKey] : null;
  const feePercent = fee && fee.source !== 'sem taxa' ? fee.used : null;

  const items = useMemo(() => procedureStockItems(procedure, insumosMap, times), [procedure, insumosMap, times]);
  const untracked = procedure.items.filter((item) => insumosMap.has(item.insumoId) && !isStockTracked(insumosMap.get(item.insumoId)));
  const missingInsumos = procedure.items.filter((item) => !insumosMap.has(item.insumoId)).length;

  const rows = items.map((item) => {
    const available = stock?.get(item.insumoId)?.available ?? 0;
    return { ...item, insumo: insumosMap.get(item.insumoId), available, short: stock !== null && available < item.quantity };
  });
  const hasShortage = realized && rows.some((row) => row.short);

  const changeTimes = (next) => {
    const count = Math.max(1, Math.round(next));
    setTimes(count);
    if (!valueTouched) setValue(Number((unitPrice * count).toFixed(2)));
  };

  const handleConfirm = async () => {
    if (!date) return setError('Informe a data do atendimento.');
    if (!(value >= 0)) return setError('Informe o valor cobrado (pode ser zero).');
    setSaving(true);
    setError('');
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
        notes: notes.trim(),
        items,
      });
      onDone({ times, status: effectiveStatus, date });
    } catch (saveError) {
      if (saveError.missing) {
        const list = saveError.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ');
        setError(`Estoque insuficiente, nada foi registrado. ${list}.`);
      } else {
        setError(saveError.message);
      }
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      wide
      title="Registrar atendimento"
      subtitle={realized
        ? `${procedure.name} — entra no resultado do mês da data abaixo e baixa os itens do estoque (lotes que vencem primeiro).`
        : `${procedure.name} — fica na agenda e entra na previsão do mês. O estoque só é baixado quando for concluído.`}
      onClose={onClose}
      onSubmit={handleConfirm}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || (realized && (stock === null || hasShortage))}>
            {saving ? 'Registrando…' : realized ? (items.length > 0 ? 'Registrar e baixar estoque' : 'Registrar atendimento') : 'Agendar'}
          </button>
        </div>
      )}
    >
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="form-row">
        <Field label="Situação">
          <Segmented label="Situação" options={STATUS_OPTIONS} value={effectiveStatus} onChange={setStatus} />
        </Field>
        <Field label="Data" hint={isFuture ? 'Data futura: fica como agendado.' : realized ? 'Pode ser uma data passada.' : 'Dia marcado.'}>
          <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
        </Field>
        <Field label="Quantas vezes">
          <NumberInput min={1} label="Quantas vezes" value={times} onChange={changeTimes} className="w-small" />
        </Field>
      </div>

      <div className="form-row">
        <Field label="Valor cobrado" hint={`Preço da ficha: ${formatBRL(unitPrice)}${times > 1 ? ` × ${times}` : ''}`}>
          <NumberInput min={0} prefix="R$" label="Valor cobrado" value={value} onChange={(next) => { setValueTouched(true); setValue(next); }} />
        </Field>
        <Field
          label="Forma de pagamento"
          hint={fee && feePercent != null ? `Taxa ${formatDecimal(feePercent, 2)}% (${fee.source === 'clínica' ? 'cadastrada pela clínica' : 'média do Banco Central'})` : realized ? 'Opcional' : 'Pode deixar para depois'}
        >
          <select value={form} onChange={(event) => setForm(event.target.value)}>
            <option value="">Não informada</option>
            {PAYMENT_FORMS.map((item) => <option key={item.key} value={item.forma}>{item.label}</option>)}
          </select>
        </Field>
      </div>

      <div className="form-row">
        <Field label="Paciente (opcional)">
          <input type="text" placeholder="Ex: Thor (tutor Ana)" value={patient} onChange={(event) => setPatient(event.target.value)} />
        </Field>
        <Field label="Observação (opcional)" className="grow-2">
          <input type="text" placeholder="Ex: prontuário 123" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>

      {realized ? (
        <>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Item baixado do estoque</th><th className="right">Gasta</th><th className="right">Em estoque</th></tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.insumoId}>
                    <td>{row.insumo?.name}</td>
                    <td className="right">{formatDecimal(row.quantity, 3)} {row.insumo?.unit}</td>
                    <td className={`right ${row.short ? 'danger-text' : ''}`}>{stock === null ? '…' : `${formatDecimal(row.available, 3)} ${row.insumo?.unit}`}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={3} className="empty-text">Nenhum item com controle de estoque nesta ficha.</td></tr>}
              </tbody>
            </table>
          </div>
          {hasShortage && <p className="error-text">Falta estoque dos itens em vermelho. Dê entrada da compra no Estoque (ou ajuste a ficha) antes de registrar.</p>}
          {untracked.length > 0 && (
            <p className="muted">Não entram na baixa (sem controle de estoque): {untracked.map((item) => insumosMap.get(item.insumoId).name).join(', ')}.</p>
          )}
          {missingInsumos > 0 && <p className="muted">{missingInsumos} item(ns) da ficha não existem mais no estoque e foram ignorados.</p>}
        </>
      ) : (
        <p className="muted">Os agendados aparecem em <strong>Resultado do mês</strong>, onde podem ser concluídos (aí o estoque é baixado) ou cancelados.</p>
      )}
    </Modal>
  );
}
