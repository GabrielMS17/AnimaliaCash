import { useCallback, useEffect, useMemo, useState } from 'react';
import InsumoModal, { CATEGORY_OPTIONS, describePackage } from '../components/InsumoModal';
import StockEntryModal from '../components/StockEntryModal';
import StockItemModal from '../components/StockItemModal';
import { CATEGORY_DOT, SectionHeader, Segmented } from '../components/ui';
import { daysUntil, EXPIRING_DAYS, fetchLots, formatDateBR, isStockTracked, summarizeLots } from '../services/stockService';
import { useData } from '../store/DataContext';
import { formatBRL, formatDecimal, formatUnitCost, getCategoryLabel } from '../utils/costCalculations';

const CATEGORY_FILTERS = [{ value: 'todos', label: 'Todas as categorias' }, ...CATEGORY_OPTIONS];
const STATUS_FILTERS = [
  { value: 'todos', label: 'Todos' },
  { value: 'baixo', label: 'Abaixo do mínimo' },
  { value: 'validade', label: 'Vencidos / a vencer' },
  { value: 'sem_estoque', label: 'Sem estoque' },
];

/** Estoque: cadastro dos itens (antigo Insumos), saldo por lote, validade, entradas e baixas. Igual ao app. */
export default function Estoque() {
  const { insumos, procedures, saveInsumo, deleteInsumo, flushPending } = useData();
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [lotsError, setLotsError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('todos');
  const [status, setStatus] = useState('todos');
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, insumo = edição
  const [entryFor, setEntryFor] = useState(null); // null = fechado, {} = escolher item, insumo = item escolhido
  const [detailId, setDetailId] = useState(null);

  // Busca os lotes com saldo; os estados só mudam quando a resposta chega
  const loadLots = useCallback(() => fetchLots().then(
    (result) => {
      setLots(result);
      setLotsError('');
      setLoadingLots(false);
    },
    (error) => {
      setLotsError(error.message);
      setLoadingLots(false);
    },
  ), []);

  useEffect(() => {
    loadLots();
  }, [loadLots]);

  const stock = useMemo(() => summarizeLots(lots), [lots]);

  const usageCount = useMemo(() => {
    const map = new Map();
    procedures.forEach((procedure) => {
      new Set(procedure.items.map((item) => item.insumoId)).forEach((id) => map.set(id, (map.get(id) || 0) + 1));
    });
    return map;
  }, [procedures]);

  const rows = useMemo(() => insumos.map((insumo) => {
    const entry = stock.get(insumo.id);
    const tracked = isStockTracked(insumo);
    const available = entry?.available ?? 0;
    const expiryDays = daysUntil(entry?.nextExpiry);
    return {
      insumo,
      entry,
      tracked,
      available,
      low: tracked && insumo.minStock > 0 && available < insumo.minStock,
      empty: tracked && available <= 0,
      expired: (entry?.expired ?? 0) > 0,
      expiring: expiryDays !== null && expiryDays <= EXPIRING_DAYS,
      expiryDays,
    };
  }), [insumos, stock]);

  const totals = useMemo(() => ({
    tracked: rows.filter((row) => row.tracked).length,
    low: rows.filter((row) => row.low).length,
    expiry: rows.filter((row) => row.expired || row.expiring).length,
    value: rows.reduce((sum, row) => sum + (row.entry?.value ?? 0), 0),
  }), [rows]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => category === 'todos' || row.insumo.category === category)
      .filter((row) => {
        if (status === 'baixo') return row.low;
        if (status === 'validade') return row.expired || row.expiring;
        if (status === 'sem_estoque') return row.empty;
        return true;
      })
      .filter((row) => !query || [row.insumo.name, row.insumo.notes, row.insumo.brand].some((text) => (text ?? '').toLowerCase().includes(query)))
      .sort((a, b) => a.insumo.name.localeCompare(b.insumo.name, 'pt-BR'));
  }, [rows, search, category, status]);

  const handleDelete = (insumo) => {
    const count = usageCount.get(insumo.id) || 0;
    const hasStock = (stock.get(insumo.id)?.lots.length ?? 0) > 0;
    const warnings = [
      count > 0 ? `é usado em ${count} procedimento(s)` : null,
      hasStock ? 'tem lotes em estoque, que serão apagados junto com o histórico' : null,
    ].filter(Boolean);
    const message = warnings.length > 0
      ? `"${insumo.name}" ${warnings.join(' e ')}. Deseja realmente excluí-lo?`
      : `Deseja excluir "${insumo.name}"?`;
    if (window.confirm(message)) deleteInsumo(insumo.id);
  };

  const detailRow = detailId ? rows.find((row) => row.insumo.id === detailId) : null;

  return (
    <>
      <SectionHeader
        title="Estoque"
        description="Itens usados nos procedimentos, com custo, saldo por lote e validade. Alterar um custo recalcula os procedimentos; realizar um procedimento baixa os itens do estoque."
        action={(
          <div className="inline">
            <button type="button" className="btn btn-primary" onClick={() => setEntryFor({})}>+ Entrada de compra</button>
            <button type="button" className="btn btn-secondary" onClick={() => setEditing({})}>+ Novo item</button>
          </div>
        )}
      />

      <div className="stock-summary">
        <SummaryCard label="Itens com controle de estoque" value={String(totals.tracked)} />
        <SummaryCard label="Abaixo do mínimo" value={String(totals.low)} alert={totals.low > 0} onShow={() => setStatus('baixo')} />
        <SummaryCard label={`Vencidos ou vencendo em ${EXPIRING_DAYS} dias`} value={String(totals.expiry)} alert={totals.expiry > 0} onShow={() => setStatus('validade')} />
        <SummaryCard label="Valor em estoque" value={formatBRL(totals.value)} />
      </div>

      {lotsError && <div className="error-banner" role="alert">{lotsError}</div>}

      <div className="filters stock-filters">
        <div className="stock-filter-groups">
          <Segmented label="Filtrar por categoria" options={CATEGORY_FILTERS} value={category} onChange={setCategory} />
          <Segmented label="Filtrar por situação" options={STATUS_FILTERS} value={status} onChange={setStatus} />
        </div>
        <input type="search" aria-label="Buscar item" placeholder="Buscar por nome ou marca" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      <p className="count">{filtered.length} de {insumos.length} itens{loadingLots ? ' · carregando saldos…' : ''}</p>

      <div className="list-card">
        {filtered.map((row) => (
          <StockRow
            key={row.insumo.id}
            row={row}
            usage={usageCount.get(row.insumo.id) || 0}
            onEntry={() => setEntryFor(row.insumo)}
            onDetail={() => setDetailId(row.insumo.id)}
            onEdit={() => setEditing(row.insumo)}
            onDelete={() => handleDelete(row.insumo)}
          />
        ))}
        {filtered.length === 0 && <p className="empty-text">Nenhum item encontrado.</p>}
      </div>

      {editing && (
        <InsumoModal
          insumo={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            saveInsumo(saved);
            setEditing(null);
          }}
        />
      )}

      {entryFor && (
        <StockEntryModal
          insumo={entryFor.id ? entryFor : null}
          insumos={insumos.filter(isStockTracked)}
          flushPending={flushPending}
          onUpdateInsumo={saveInsumo}
          onClose={() => setEntryFor(null)}
          onSaved={() => {
            setEntryFor(null);
            loadLots();
          }}
        />
      )}

      {detailRow && (
        <StockItemModal
          insumo={detailRow.insumo}
          entry={detailRow.entry}
          onClose={() => setDetailId(null)}
          onChanged={loadLots}
          onEntry={() => {
            setDetailId(null);
            setEntryFor(detailRow.insumo);
          }}
        />
      )}
    </>
  );
}

function SummaryCard({ label, value, alert, onShow }) {
  return (
    <div className={`card stock-summary-card ${alert ? 'alert' : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      {alert && onShow && <button type="button" className="btn btn-ghost btn-small" onClick={onShow}>Ver itens</button>}
    </div>
  );
}

function StockRow({ row, usage, onEntry, onDetail, onEdit, onDelete }) {
  const { insumo, entry, tracked, available } = row;
  const pkg = describePackage(insumo);
  const badges = [];
  if (row.empty) badges.push({ text: 'Sem estoque', tone: 'danger' });
  else if (row.low) badges.push({ text: `Abaixo do mínimo (${formatDecimal(insumo.minStock, 3)} ${insumo.unit})`, tone: 'danger' });
  if (row.expired) badges.push({ text: `${formatDecimal(entry.expired, 3)} ${insumo.unit} vencido`, tone: 'danger' });
  else if (row.expiring) {
    badges.push({ text: row.expiryDays === 0 ? 'Vence hoje' : `Vence em ${row.expiryDays} dias (${formatDateBR(entry.nextExpiry)})`, tone: 'warning' });
  }

  return (
    <div className="list-row stock-row">
      <div className="list-main">
        <strong>{insumo.name}</strong>
        {(insumo.brand || insumo.notes) && <small>{[insumo.brand, insumo.notes].filter(Boolean).join(' · ')}</small>}
        <small className="category-line">
          <i className="dot" style={{ background: CATEGORY_DOT[insumo.category] }} />
          {getCategoryLabel(insumo.category)} · {usage === 0 ? 'não usado' : `usado em ${usage} ${usage === 1 ? 'procedimento' : 'procedimentos'}`}
        </small>
        {badges.length > 0 && (
          <span className="stock-badges">
            {badges.map((badge) => <span key={badge.text} className={`stock-badge ${badge.tone}`}>{badge.text}</span>)}
          </span>
        )}
      </div>
      <div className="stock-qty">
        {tracked ? (
          <>
            <strong className={row.empty ? 'danger-text' : ''}>{formatDecimal(available, 3)} <span>{insumo.unit}</span></strong>
            <small>{entry?.lots.length ? `${entry.lots.length} ${entry.lots.length === 1 ? 'lote' : 'lotes'}` : 'nenhum lote'}</small>
          </>
        ) : (
          <small>Sem controle de estoque</small>
        )}
      </div>
      <div className="list-cost">
        <strong>{formatUnitCost(insumo.costPerUnit)}<span> / {insumo.unit}</span></strong>
        {pkg && <small>{pkg}</small>}
      </div>
      <div className="list-actions">
        {tracked && <button type="button" className="btn btn-primary btn-small" onClick={onEntry}>Entrada</button>}
        {tracked && <button type="button" className="btn btn-secondary btn-small" onClick={onDetail}>Lotes</button>}
        <button type="button" className="btn btn-secondary btn-small" onClick={onEdit}>Editar</button>
        <button type="button" className="btn btn-danger btn-small" onClick={onDelete}>Excluir</button>
      </div>
    </div>
  );
}
