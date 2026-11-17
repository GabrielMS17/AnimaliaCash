import { useMemo, useState } from 'react';
import { isStockTracked } from '../services/stockService';
import { formatDecimal } from '../utils/costCalculations';

/**
 * Lista editável dos itens baixados do estoque num atendimento.
 * Começa com a ficha técnica; dá para mudar quantidades, retirar itens e adicionar outros do estoque.
 * items: [{ insumoId, quantity }]; expected: Map(insumoId -> quantidade da ficha).
 */
export default function StockItemsEditor({ items, expected, onChange, insumos, insumosMap, stock, disabled = false }) {
  const [adding, setAdding] = useState('');

  const available = (insumoId) => stock?.get(insumoId)?.available ?? 0;
  const addable = useMemo(() => insumos
    .filter((insumo) => isStockTracked(insumo) && !expected.has(insumo.id) && !items.some((item) => item.insumoId === insumo.id))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')), [insumos, items, expected]);

  // Itens da ficha que foram retirados continuam visíveis (riscados) para dar para devolver
  const removed = [...expected.keys()].filter((id) => !items.some((item) => item.insumoId === id));

  const setQuantity = (insumoId, value) => {
    const quantity = Number(String(value).replace(',', '.'));
    onChange(items.map((item) => (item.insumoId === insumoId ? { ...item, quantity: Number.isFinite(quantity) ? quantity : 0 } : item)));
  };

  const remove = (insumoId) => onChange(items.filter((item) => item.insumoId !== insumoId));
  const restore = (insumoId) => onChange([...items, { insumoId, quantity: expected.get(insumoId) }]);
  const add = (insumoId) => {
    if (!insumoId) return;
    onChange([...items, { insumoId, quantity: 1 }]);
    setAdding('');
  };

  return (
    <div className="items-editor">
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>Item baixado do estoque</th>
              <th className="right">Ficha</th>
              <th className="right">Usado</th>
              <th className="right">Em estoque</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const insumo = insumosMap.get(item.insumoId);
              const base = expected.get(item.insumoId);
              const changed = base === undefined ? 'added' : Math.abs(base - item.quantity) > 1e-9 ? 'changed' : '';
              const short = stock !== null && available(item.insumoId) < item.quantity;
              return (
                <tr key={item.insumoId} className={changed ? `item-${changed}` : ''}>
                  <td>
                    {insumo?.name ?? item.insumoId}
                    {changed === 'added' && <small className="item-tag">adicionado</small>}
                    {changed === 'changed' && <small className="item-tag">ajustado</small>}
                  </td>
                  <td className="right muted">{base === undefined ? '—' : `${formatDecimal(base, 3)}`}</td>
                  <td className="right">
                    <span className="qty-input">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        inputMode="decimal"
                        aria-label={`Quantidade usada de ${insumo?.name}`}
                        value={item.quantity}
                        disabled={disabled}
                        onChange={(event) => setQuantity(item.insumoId, event.target.value)}
                      />
                      <span className="muted">{insumo?.unit}</span>
                    </span>
                  </td>
                  <td className={`right ${short ? 'danger-text' : ''}`}>
                    {stock === null ? '…' : `${formatDecimal(available(item.insumoId), 3)} ${insumo?.unit ?? ''}`}
                  </td>
                  <td className="right">
                    <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={() => remove(item.insumoId)} aria-label={`Retirar ${insumo?.name}`}>
                      Retirar
                    </button>
                  </td>
                </tr>
              );
            })}
            {removed.map((insumoId) => {
              const insumo = insumosMap.get(insumoId);
              return (
                <tr key={`removed-${insumoId}`} className="item-removed">
                  <td>{insumo?.name}<small className="item-tag">não usado</small></td>
                  <td className="right muted">{formatDecimal(expected.get(insumoId), 3)}</td>
                  <td className="right muted">0 {insumo?.unit}</td>
                  <td />
                  <td className="right">
                    <button type="button" className="btn btn-ghost btn-small" disabled={disabled} onClick={() => restore(insumoId)}>Devolver</button>
                  </td>
                </tr>
              );
            })}
            {items.length === 0 && removed.length === 0 && (
              <tr><td colSpan={5} className="empty-text">Nenhum item com controle de estoque nesta ficha.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="items-add">
        <select aria-label="Adicionar insumo" value={adding} disabled={disabled} onChange={(event) => add(event.target.value)}>
          <option value="">+ Adicionar insumo que não está na ficha…</option>
          {addable.map((insumo) => <option key={insumo.id} value={insumo.id}>{insumo.name} ({insumo.unit})</option>)}
        </select>
      </div>
    </div>
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
