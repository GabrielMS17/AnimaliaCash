import { useCallback, useEffect, useState } from 'react';
import { daysUntil, EXPIRING_DAYS, fetchMovements, formatDateBR, registerWriteOff, WRITE_OFF_REASONS } from '../services/stockService';
import { formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { PACKAGE_OPTIONS } from './InsumoModal';
import { Field, Modal, NumberInput } from './ui';

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

  if (writeOff) {
    return (
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
    );
  }

  return (
    <Modal
      wide
      title={insumo.name}
      subtitle={`Saldo disponível: ${formatDecimal(entry?.available ?? 0, 3)} ${unit}${entry?.averageCost ? ` · custo médio ${formatUnitCost(entry.averageCost)} / ${unit}` : ''}`}
      onClose={onClose}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={onEntry}>+ Entrada de compra</button>
        </div>
      )}
    >
      <h3>Lotes em estoque</h3>
      {lots.length === 0 ? (
        <p className="muted">Nenhum lote com saldo. Use “Entrada de compra” para abastecer.</p>
      ) : (
        <div className="stock-lots">
          {lots.map((lot) => {
            const days = daysUntil(lot.expiresAt);
            const expired = days !== null && days < 0;
            const expiring = days !== null && !expired && days <= EXPIRING_DAYS;
            const pkg = PACKAGE_OPTIONS.find((option) => option.value === lot.packageType)?.label;
            return (
              <div key={lot.id} className="stock-lot">
                <div className="stock-lot-info">
                  <strong>{lot.lotNumber ? `Lote ${lot.lotNumber}` : 'Sem número de lote'}</strong>
                  <small className={expired ? 'danger-text' : expiring ? 'warning' : ''}>
                    {lot.expiresAt
                      ? `${expired ? 'Venceu em' : 'Validade'} ${formatDateBR(lot.expiresAt)}${expiring ? ` (${days === 0 ? 'hoje' : `${days} dias`})` : ''}`
                      : 'Sem validade'}
                  </small>
                  <small>
                    Entrada em {formatDateBR(lot.createdAt)}
                    {pkg && lot.packages ? ` · ${formatDecimal(lot.packages, 3)} ${pkg.toLowerCase()} × ${formatDecimal(lot.unitsPerPackage, 3)} ${unit}` : ''}
                    {` · ${formatUnitCost(lot.unitCost)} / ${unit}`}
                  </small>
                </div>
                <div className="stock-lot-side">
                  <strong className={expired ? 'danger-text' : ''}>
                    {formatDecimal(lot.quantity, 3)} <span>de {formatDecimal(lot.initialQuantity, 3)} {unit}</span>
                  </strong>
                  <button type="button" className="btn btn-danger btn-small" onClick={() => setWriteOff(lot)}>Dar baixa</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <h3>Últimas movimentações</h3>
      {historyError && <div className="error-banner" role="alert">{historyError}</div>}
      {movements === null && !historyError && <p className="muted">Carregando…</p>}
      {movements?.length === 0 && <p className="muted">Nenhuma movimentação ainda.</p>}
      {movements?.length > 0 && (
        <div className="stock-lots">
          {movements.map((movement) => (
            <div key={movement.id} className="stock-lot">
              <div className="stock-lot-info">
                <strong>{MOVEMENT_LABEL[movement.type] ?? movement.type}{movement.procedureName ? ` · ${movement.procedureName}` : ''}</strong>
                <small>
                  {new Date(movement.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                  {movement.lotNumber ? ` · lote ${movement.lotNumber}` : ''}
                  {movement.notes ? ` · ${movement.notes}` : ''}
                </small>
              </div>
              <strong className={movement.quantity < 0 ? 'danger-text' : 'positive-text'}>
                {movement.quantity > 0 ? '+' : ''}{formatDecimal(movement.quantity, 3)} {unit}
              </strong>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}

function WriteOffModal({ lot, unit, onClose, onDone }) {
  const expired = (daysUntil(lot.expiresAt) ?? 0) < 0;
  const [quantity, setQuantity] = useState(lot.quantity);
  const [reason, setReason] = useState(expired ? 'Vencido' : 'Avaria / quebra');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!(quantity > 0)) return setError('Informe a quantidade da baixa.');
    if (quantity > lot.quantity) return setError(`O lote tem só ${formatDecimal(lot.quantity, 3)} ${unit}.`);
    setSaving(true);
    try {
      await registerWriteOff({
        lotId: lot.id,
        quantity,
        type: reason === 'Ajuste de inventário' ? 'ajuste' : 'perda',
        notes: [reason, notes.trim()].filter(Boolean).join(' — '),
      });
      onDone();
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      title="Dar baixa no lote"
      subtitle={`${lot.lotNumber ? `Lote ${lot.lotNumber}` : 'Lote sem número'} · ${formatDecimal(lot.quantity, 3)} ${unit} disponíveis`}
      onClose={onClose}
      onSubmit={handleSave}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Voltar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Confirmar baixa'}</button>
        </div>
      )}
    >
      {error && <div className="error-banner" role="alert">{error}</div>}
      <Field label="Motivo">
        <select value={reason} onChange={(event) => setReason(event.target.value)}>
          {WRITE_OFF_REASONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </Field>
      <Field label="Quantidade">
        <NumberInput min={0} label="Quantidade da baixa" value={quantity} onChange={setQuantity} suffix={unit} className="w-small" />
      </Field>
      <Field label="Observação (opcional)">
        <input type="text" placeholder="Ex: frasco quebrou na prateleira" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}
