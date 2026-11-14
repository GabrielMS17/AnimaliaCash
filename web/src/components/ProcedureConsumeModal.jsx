import { useEffect, useMemo, useState } from 'react';
import { consumeProcedure, fetchLots, isStockTracked, procedureStockItems, summarizeLots } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';
import { Field, Modal, NumberInput } from './ui';

/** Registra que um procedimento foi realizado e baixa do estoque os itens da ficha técnica. */
export default function ProcedureConsumeModal({ procedure, insumosMap, flushPending, onClose, onDone }) {
  const [times, setTimes] = useState(1);
  const [notes, setNotes] = useState('');
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

  const items = useMemo(() => procedureStockItems(procedure, insumosMap, times), [procedure, insumosMap, times]);
  const untracked = procedure.items.filter((item) => insumosMap.has(item.insumoId) && !isStockTracked(insumosMap.get(item.insumoId)));
  const missingInsumos = procedure.items.filter((item) => !insumosMap.has(item.insumoId)).length;

  const rows = items.map((item) => {
    const available = stock?.get(item.insumoId)?.available ?? 0;
    return { ...item, insumo: insumosMap.get(item.insumoId), available, short: stock !== null && available < item.quantity };
  });
  const hasShortage = rows.some((row) => row.short);

  const handleConfirm = async () => {
    if (items.length === 0) return setError('Este procedimento não tem itens com controle de estoque.');
    setSaving(true);
    setError('');
    try {
      await flushPending();
      await consumeProcedure({ procedure, items, notes: notes.trim() });
      onDone(times);
    } catch (consumeError) {
      if (consumeError.missing) {
        const list = consumeError.missing
          .map((row) => `${insumosMap.get(row.insumoId)?.name ?? row.insumoId}: precisa de ${formatDecimal(row.needed, 3)}, tem ${formatDecimal(row.available, 3)}`)
          .join('; ');
        setError(`Estoque insuficiente, nada foi baixado. ${list}.`);
      } else {
        setError(consumeError.message);
      }
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      wide
      title="Registrar realização"
      subtitle={`${procedure.name} — os itens abaixo serão baixados do estoque, começando pelos lotes que vencem primeiro.`}
      onClose={onClose}
      onSubmit={handleConfirm}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving || stock === null || hasShortage || items.length === 0}>
            {saving ? 'Registrando…' : 'Confirmar e baixar estoque'}
          </button>
        </div>
      )}
    >
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="form-row">
        <Field label="Quantas vezes foi realizado">
          <NumberInput min={1} label="Quantas vezes foi realizado" value={times} onChange={(value) => setTimes(Math.max(1, Math.round(value)))} className="w-small" />
        </Field>
        <Field label="Observação (opcional)" className="grow-2">
          <input type="text" placeholder="Ex: paciente Thor, prontuário 123" value={notes} onChange={(event) => setNotes(event.target.value)} />
        </Field>
      </div>

      <div className="table-scroll">
        <table>
          <thead>
            <tr><th>Item</th><th className="right">Gasta</th><th className="right">Em estoque</th></tr>
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
    </Modal>
  );
}
