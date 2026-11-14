import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  daysUntil,
  EXPIRING_DAYS,
  fetchLots,
  formatDateBR,
  isStockTracked,
  summarizeLots,
} from '../services/stockService';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { formatBRL, formatDecimal, formatUnitCost, getCategoryLabel } from '../utils/costCalculations';
import InsumoModal, { CATEGORY_OPTIONS, describePackage } from './InsumoModal';
import StockEntryModal from './StockEntryModal';
import StockItemModal from './StockItemModal';
import { Button, CATEGORY_DOT, COLORS, confirmAction, ErrorBanner, Input, SectionHeader, Segmented, useIsWide } from './ui';

const STATUS_OPTIONS = [
  { value: 'todos', label: 'Todos' },
  { value: 'baixo', label: 'Abaixo do mínimo' },
  { value: 'validade', label: 'Vencidos / a vencer' },
  { value: 'sem_estoque', label: 'Sem estoque' },
];

/** Estoque: cadastro dos itens (antigo Insumos), saldo por lote, validade, entradas e baixas. */
export default function StockPage() {
  const { insumos, procedures, saveInsumo, deleteInsumo, flushPending } = useAnimaliaData();
  const isWide = useIsWide();
  const [lots, setLots] = useState([]);
  const [loadingLots, setLoadingLots] = useState(true);
  const [lotsError, setLotsError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('todos');
  const [filterStatus, setFilterStatus] = useState('todos');
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

  // Situação de cada item: saldo, alertas de mínimo e de validade
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
    const query = searchTerm.trim().toLowerCase();
    return rows
      .filter((row) => filterCategory === 'todos' || row.insumo.category === filterCategory)
      .filter((row) => {
        if (filterStatus === 'baixo') return row.low;
        if (filterStatus === 'validade') return row.expired || row.expiring;
        if (filterStatus === 'sem_estoque') return row.empty;
        return true;
      })
      .filter((row) => {
        if (!query) return true;
        const { name, notes, brand } = row.insumo;
        return [name, notes, brand].some((text) => (text ?? '').toLowerCase().includes(query));
      })
      .sort((a, b) => a.insumo.name.localeCompare(b.insumo.name, 'pt-BR'));
  }, [rows, searchTerm, filterCategory, filterStatus]);

  const handleDelete = async (insumo) => {
    const count = usageCount.get(insumo.id) || 0;
    const hasStock = (stock.get(insumo.id)?.lots.length ?? 0) > 0;
    const warnings = [
      count > 0 ? `é usado em ${count} procedimento(s)` : null,
      hasStock ? 'tem lotes em estoque, que serão apagados junto com o histórico' : null,
    ].filter(Boolean);
    const message = warnings.length > 0
      ? `"${insumo.name}" ${warnings.join(' e ')}. Deseja realmente excluí-lo?`
      : `Deseja excluir "${insumo.name}"?`;
    if (await confirmAction(message, 'Excluir')) deleteInsumo(insumo.id);
  };

  const detailRow = detailId ? rows.find((row) => row.insumo.id === detailId) : null;

  return (
    <View>
      <SectionHeader
        title="Estoque"
        description="Itens usados nos procedimentos, com custo, saldo por lote e validade. Alterar um custo recalcula os procedimentos; realizar um procedimento baixa os itens do estoque."
        action={
          <View style={styles.headerActions}>
            <Button label="+ Entrada de compra" onPress={() => setEntryFor({})} />
            <Button variant="secondary" label="+ Novo item" onPress={() => setEditing({})} />
          </View>
        }
      />

      <View style={styles.summary}>
        <SummaryCard label="Itens com controle de estoque" value={String(totals.tracked)} />
        <SummaryCard label="Abaixo do mínimo" value={String(totals.low)} alert={totals.low > 0} onPress={() => setFilterStatus('baixo')} />
        <SummaryCard label={`Vencidos ou vencendo em ${EXPIRING_DAYS} dias`} value={String(totals.expiry)} alert={totals.expiry > 0} onPress={() => setFilterStatus('validade')} />
        <SummaryCard label="Valor em estoque" value={formatBRL(totals.value)} />
      </View>

      <ErrorBanner message={lotsError} />

      <View style={[styles.filters, isWide && styles.filtersWide]}>
        <View style={{ flexShrink: 1, gap: 8 }}>
          <Segmented options={[{ value: 'todos', label: 'Todas as categorias' }, ...CATEGORY_OPTIONS]} value={filterCategory} onChange={setFilterCategory} />
          <Segmented options={STATUS_OPTIONS} value={filterStatus} onChange={setFilterStatus} />
        </View>
        <Input placeholder="Buscar por nome ou marca" value={searchTerm} onChangeText={setSearchTerm} style={isWide && { width: 260 }} />
      </View>

      <Text style={styles.count}>
        {filtered.length} de {insumos.length} itens{loadingLots ? ' · carregando saldos…' : ''}
      </Text>

      <View style={styles.list}>
        {filtered.map((row) => (
          <StockRow
            key={row.insumo.id}
            row={row}
            usage={usageCount.get(row.insumo.id) || 0}
            isWide={isWide}
            onEntry={() => setEntryFor(row.insumo)}
            onDetail={() => setDetailId(row.insumo.id)}
            onEdit={() => setEditing(row.insumo)}
            onDelete={() => handleDelete(row.insumo)}
          />
        ))}
        {filtered.length === 0 && <Text style={styles.empty}>Nenhum item encontrado.</Text>}
      </View>

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
    </View>
  );
}

function SummaryCard({ label, value, alert, onPress }) {
  return (
    <View style={[styles.summaryCard, alert && styles.summaryCardAlert]}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={[styles.summaryValue, alert && { color: COLORS.danger }]}>{value}</Text>
      {alert && onPress ? <Button small variant="ghost" label="Ver itens" onPress={onPress} style={styles.summaryLink} /> : null}
    </View>
  );
}

function StockRow({ row, usage, isWide, onEntry, onDetail, onEdit, onDelete }) {
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
    <View style={[styles.row, isWide && styles.rowWide]}>
      <View style={[styles.infoCol, isWide && styles.infoColWide]}>
        <Text style={styles.name}>{insumo.name}</Text>
        {insumo.brand || insumo.notes ? (
          <Text style={styles.notes}>{[insumo.brand, insumo.notes].filter(Boolean).join(' · ')}</Text>
        ) : null}
        <View style={styles.categoryRow}>
          <View style={[styles.dot, { backgroundColor: CATEGORY_DOT[insumo.category] ?? COLORS.faint }]} />
          <Text style={styles.notes}>{getCategoryLabel(insumo.category)}</Text>
          <Text style={styles.notes}>· {usage === 0 ? 'não usado' : `usado em ${usage} ${usage === 1 ? 'procedimento' : 'procedimentos'}`}</Text>
        </View>
        {badges.length > 0 && (
          <View style={styles.badges}>
            {badges.map((badge) => (
              <Text key={badge.text} style={[styles.badge, badge.tone === 'danger' ? styles.badgeDanger : styles.badgeWarning]}>{badge.text}</Text>
            ))}
          </View>
        )}
      </View>

      <View style={[styles.stockCol, isWide && styles.stockColWide]}>
        {tracked ? (
          <>
            <Text style={[styles.stockValue, row.empty && { color: COLORS.danger }]}>
              {formatDecimal(available, 3)} <Text style={styles.unit}>{insumo.unit}</Text>
            </Text>
            <Text style={styles.notes}>
              {entry?.lots.length ? `${entry.lots.length} ${entry.lots.length === 1 ? 'lote' : 'lotes'}` : 'nenhum lote'}
            </Text>
          </>
        ) : (
          <Text style={styles.notes}>Sem controle de estoque</Text>
        )}
      </View>

      <View style={[styles.costCol, isWide && styles.costColWide]}>
        <Text style={styles.cost}>
          {formatUnitCost(insumo.costPerUnit)}
          <Text style={styles.unit}> / {insumo.unit}</Text>
        </Text>
        {pkg ? <Text style={styles.notes}>{pkg}</Text> : null}
      </View>

      <View style={styles.actions}>
        {tracked && <Button small label="Entrada" onPress={onEntry} />}
        {tracked && <Button small variant="secondary" label="Lotes" onPress={onDetail} />}
        <Button small variant="secondary" label="Editar" onPress={onEdit} />
        <Button small variant="danger" label="Excluir" onPress={onDelete} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summary: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  summaryCard: {
    flexGrow: 1,
    flexBasis: 160,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  summaryCardAlert: { borderColor: '#FECDD3', backgroundColor: COLORS.dangerSoft },
  summaryLabel: { fontSize: 12, color: COLORS.muted },
  summaryValue: { fontSize: 20, fontWeight: '800', color: COLORS.text, marginTop: 4 },
  summaryLink: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 2 },
  filters: { gap: 10, marginBottom: 12 },
  filtersWide: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  count: { fontSize: 13, color: COLORS.muted, marginBottom: 10 },
  list: {
    backgroundColor: COLORS.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'column',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  rowWide: { flexDirection: 'row', alignItems: 'center' },
  infoCol: { minWidth: 0 },
  infoColWide: { flex: 2.2 },
  stockCol: { minWidth: 0 },
  stockColWide: { flex: 1, alignItems: 'flex-end' },
  costCol: { alignItems: 'flex-start', minWidth: 0 },
  costColWide: { flex: 1.2, alignItems: 'flex-end' },
  name: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  notes: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 2 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
  badge: { fontSize: 11, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  badgeDanger: { color: COLORS.danger, backgroundColor: COLORS.dangerSoft },
  badgeWarning: { color: COLORS.warning, backgroundColor: '#FEF3C7' },
  stockValue: { fontSize: 16, fontWeight: '800', color: COLORS.text },
  cost: { fontSize: 14, fontWeight: '600', color: COLORS.text, flexShrink: 1 },
  unit: { fontWeight: '400', color: COLORS.faint, fontSize: 13 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignSelf: 'flex-start' },
  empty: { padding: 32, textAlign: 'center', color: COLORS.muted },
});
