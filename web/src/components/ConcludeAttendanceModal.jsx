import { useEffect, useMemo, useState } from 'react';
import { concludeAttendance, formatDateBR, todayISO } from '../services/attendanceService';
import { fetchLots, procedureStockItems, summarizeLots } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';
import StockItemsEditor, { describeAdjustments, expectedMap, itemsToConsume } from './StockItemsEditor';
import { Field, Modal } from './ui';

/** Conclui um atendimento agendado: confere o que foi usado e baixa do estoque. */
export default function ConcludeAttendanceModal({ attendance, procedure, insumos, insumosMap, onClose, onDone }) {
  const today = todayISO();
  const times = attendance.quantidade || 1;
  const fichaItems = useMemo(() => (procedure ? procedureStockItems(procedure, insumosMap, times) : []), [procedure, insumosMap, times]);
  const expected = useMemo(() => expectedMap(fichaItems), [fichaItems]);
  const [date, setDate] = useState(attendance.data_realizacao <= today ? attendance.data_realizacao : today);
  const [items, setItems] = useState(fichaItems);
  const [stock, setStock] = useState(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLots()
      .then((lots) => active && setStock(summarizeLots(lots)))
      .catch((loadError) => active && setError(loadError.message));
    return () => {
      active = false;
    };
  }, []);

  const toConsume = itemsToConsume(items);
  const adjustments = describeAdjustments(toConsume, expected, insumosMap);
  const shortage = stock !== null && toConsume.some((item) => (stock.get(item.insumoId)?.available ?? 0) < item.quantity);

  const handleConfirm = async () => {
    if (!date || date > today) return setError('A data de realização não pode ser futura.');
    setSaving(true);
    setError('');
    try {
      await concludeAttendance({ id: attendance.id, date, items: toConsume });
      onDone({ adjusted: Boolean(adjustments) });
    } catch (concludeError) {
      setError(concludeError.missing
        ? `Estoque insuficiente, nada foi baixado. ${concludeError.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ')}.`
        : concludeError.message);
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      wide
      title="Concluir atendimento"
      subtitle={`${attendance.procedure_name}${times > 1 ? ` (${times}x)` : ''} — agendado para ${formatDateBR(attendance.data_realizacao)}${attendance.paciente ? ` · ${attendance.paciente}` : ''}.`}
      onClose={onClose}
      onSubmit={handleConfirm}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || stock === null || shortage}>
            {saving ? 'Concluindo…' : 'Concluir e baixar estoque'}
          </button>
        </div>
      )}
    >
      {error && <div className="error-banner" role="alert">{error}</div>}
      <div className="form-row">
        <Field label="Data em que foi realizado" hint="Entra no resultado do mês desta data.">
          <input type="date" value={date} max={today} onChange={(event) => setDate(event.target.value)} required />
        </Field>
      </div>
      {!procedure && <p className="warning">A ficha deste procedimento não existe mais. Adicione abaixo os itens usados, se houver.</p>}
      <div className="items-head">
        <strong>O que foi usado</strong>
        <span className="muted">Vem da ficha técnica. Ajuste se gastou mais, menos ou outro item.</span>
      </div>
      <StockItemsEditor items={items} expected={expected} onChange={setItems} insumos={insumos} insumosMap={insumosMap} stock={stock} disabled={saving} />
      {adjustments && <p className="muted">Ajuste em relação à ficha: {adjustments}.</p>}
      {shortage && <p className="error-text">Falta estoque dos itens em vermelho.</p>}
    </Modal>
  );
}
