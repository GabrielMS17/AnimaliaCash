import { useEffect, useMemo, useRef, useState } from 'react';
import { registerAttendance, todayISO } from '../services/attendanceService';
import { fetchBcbMdr } from '../services/bcbTaxas';
import { PAYMENT_FORMS, resolveFees } from '../services/monthlyResult';
import { fetchLots, isStockTracked, procedureStockItems, summarizeLots } from '../services/stockService';
import { supabase } from '../supabase';
import { calculateProcedure, formatBRL, formatDecimal } from '../utils/costCalculations';
import StockItemsEditor, { describeAdjustments, expectedMap, itemsToConsume } from './StockItemsEditor';
import { Field, Modal, NumberInput, Segmented } from './ui';

const STATUS_OPTIONS = [
  { value: 'realizado', label: 'Já foi realizado' },
  { value: 'agendado', label: 'Agendado' },
];

const CATEGORY_LABEL = { cirurgia: 'Cirurgia', internacao: 'Internação', banho_tosa: 'Banho & Tosa' };

/**
 * Registra um atendimento: quando aconteceu (ou quando vai acontecer), quanto foi cobrado, como foi pago
 * e o que foi realmente gasto. Se já foi realizado, baixa do estoque na mesma operação.
 * Sem `procedure`, mostra uma busca para escolher o procedimento entre `procedures`.
 */
export default function ProcedureConsumeModal({
  procedure: initialProcedure, procedures = [], insumos = [], insumosMap, settings, flushPending, onClose, onDone,
}) {
  const today = todayISO();
  const [procedure, setProcedure] = useState(initialProcedure ?? null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('realizado');
  const [date, setDate] = useState(today);
  const [times, setTimes] = useState(1);
  const [value, setValue] = useState(0);
  const [valueTouched, setValueTouched] = useState(false);
  const [form, setForm] = useState('');
  const [patient, setPatient] = useState('');
  const [notes, setNotes] = useState('');
  const [items, setItems] = useState([]);
  const [itemsTouched, setItemsTouched] = useState(false);
  const [reason, setReason] = useState('');
  const [stock, setStock] = useState(null);
  const [clinicFees, setClinicFees] = useState([]);
  const [bcb, setBcb] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const previousTimes = useRef(1);

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

  const unitPrice = useMemo(() => {
    if (!procedure) return 0;
    const { breakdown } = calculateProcedure(procedure, insumosMap, settings);
    return procedure.suggestedPrice > 0 ? procedure.suggestedPrice : breakdown.suggestedPriceByMargin;
  }, [procedure, insumosMap, settings]);

  const fichaItems = useMemo(
    () => (procedure ? procedureStockItems(procedure, insumosMap, times) : []),
    [procedure, insumosMap, times],
  );
  const expected = useMemo(() => expectedMap(fichaItems), [fichaItems]);

  // Ao trocar de procedimento: volta para a ficha e para o preço dela
  useEffect(() => {
    if (!procedure) return;
    setItems(procedureStockItems(procedure, insumosMap, times));
    setItemsTouched(false);
    if (!valueTouched) setValue(Number((unitPrice * times).toFixed(2)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [procedure]);

  // Data futura só pode ser agendamento
  const isFuture = date > today;
  const effectiveStatus = isFuture ? 'agendado' : status;
  const realized = effectiveStatus === 'realizado';

  const fees = useMemo(() => resolveFees(clinicFees, bcb), [clinicFees, bcb]);
  const formKey = PAYMENT_FORMS.find((item) => item.forma === form)?.key;
  const fee = formKey ? fees[formKey] : null;
  const feePercent = fee && fee.source !== 'sem taxa' ? fee.used : null;

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

  const changeItems = (next) => {
    setItems(next);
    setItemsTouched(true);
  };

  const resetItems = () => {
    setItems(fichaItems);
    setItemsTouched(false);
    setReason('');
  };

  const pickable = useMemo(() => {
    const query = search.trim().toLowerCase();
    return procedures
      .filter((p) => !query || p.name.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.targetWeightKg ?? 0) - (b.targetWeightKg ?? 0));
  }, [procedures, search]);

  const handleConfirm = async () => {
    if (!procedure) return setError('Escolha o procedimento.');
    if (!date) return setError('Informe a data do atendimento.');
    if (!(value >= 0)) return setError('Informe o valor cobrado (pode ser zero).');
    if (items.some((item) => !(item.quantity >= 0))) return setError('Confira as quantidades dos itens: nenhuma pode ser negativa.');
    setSaving(true);
    setError('');
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

  // Etapa 1 (botão "Novo atendimento"): escolher o procedimento
  if (!procedure) {
    return (
      <Modal wide title="Novo atendimento" subtitle="Escolha o procedimento realizado ou agendado." onClose={onClose}>
        <input
          type="search"
          autoFocus
          aria-label="Buscar procedimento"
          placeholder="Buscar procedimento (ex: castração)"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <ul className="procedure-pick">
          {pickable.map((p) => (
            <li key={p.id}>
              <button type="button" onClick={() => setProcedure(p)}>
                <strong>{p.name}</strong>
                <span className="muted">
                  {CATEGORY_LABEL[p.category] ?? ''}{p.targetWeightKg ? ` · ${p.targetWeightKg} kg` : ''}
                </span>
              </button>
            </li>
          ))}
          {pickable.length === 0 && <li className="empty-text">Nenhum procedimento encontrado.</li>}
        </ul>
      </Modal>
    );
  }

  return (
    <Modal
      wide
      title="Registrar atendimento"
      subtitle={realized
        ? `${procedure.name} — entra no resultado do mês da data abaixo e baixa do estoque o que foi usado (lotes que vencem primeiro).`
        : `${procedure.name} — fica na agenda e entra na previsão do mês. O estoque só é baixado quando for concluído.`}
      onClose={onClose}
      onSubmit={handleConfirm}
      footer={(
        <div className="actions-end">
          {!initialProcedure && (
            <button type="button" className="btn btn-ghost" onClick={() => setProcedure(null)} disabled={saving}>← Trocar procedimento</button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || (realized && (stock === null || shortage))}>
            {saving ? 'Registrando…' : realized ? (toConsume.length > 0 ? 'Registrar e baixar estoque' : 'Registrar atendimento') : 'Agendar'}
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
          <div className="items-head">
            <strong>O que foi usado</strong>
            <span className="muted">Vem da ficha técnica. Ajuste se gastou mais, menos ou outro item — a ficha não é alterada.</span>
            {itemsTouched && <button type="button" className="btn btn-ghost btn-small" onClick={resetItems}>Voltar para a ficha</button>}
          </div>
          <StockItemsEditor
            items={items}
            expected={expected}
            onChange={changeItems}
            insumos={insumos}
            insumosMap={insumosMap}
            stock={stock}
            disabled={saving}
          />
          {adjustments && (
            <Field label="Motivo do ajuste (opcional)" hint={`Fica registrado no atendimento: ${adjustments}`}>
              <input type="text" placeholder="Ex: intercorrência, paciente maior que o previsto" value={reason} onChange={(event) => setReason(event.target.value)} />
            </Field>
          )}
          {shortage && <p className="error-text">Falta estoque dos itens em vermelho. Dê entrada da compra no Estoque (ou ajuste as quantidades) antes de registrar.</p>}
          {untracked.length > 0 && (
            <p className="muted">Não entram na baixa (sem controle de estoque): {untracked.map((item) => insumosMap.get(item.insumoId).name).join(', ')}.</p>
          )}
        </>
      ) : (
        <p className="muted">Os agendados aparecem em <strong>Resultado do mês</strong>, onde podem ser concluídos (aí você confere o que foi usado e o estoque é baixado) ou cancelados.</p>
      )}
    </Modal>
  );
}
