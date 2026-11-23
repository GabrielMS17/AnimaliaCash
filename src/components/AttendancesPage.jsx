import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  cancelAttendance,
  fetchAttendanceItems,
  fetchAttendances,
  formatDateBR,
  todayISO,
} from '../services/attendanceService';
import { lastMonths, monthLabel } from '../services/monthlyResult';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { formatBRL, formatDecimal } from '../utils/costCalculations';
import ConcludeAttendanceModal from './ConcludeAttendanceModal';
import ProcedureConsumeModal from './ProcedureConsumeModal';
import { Button, COLORS, confirmAction, ErrorBanner, Input, SectionHeader, Segmented, Select } from './ui';

const TABS = [
  { value: 'agendado', label: 'Agendados' },
  { value: 'realizado', label: 'Finalizados' },
  { value: 'cancelado', label: 'Cancelados' },
];

// Cada perfil vê os atendimentos das áreas em que trabalha
const CATEGORIES_BY_ROLE = {
  Administrador: ['cirurgia', 'internacao', 'banho_tosa'],
  Veterinário: ['cirurgia', 'internacao'],
  'Esteticista Animal': ['banho_tosa'],
};
const CATEGORY_LABEL = { cirurgia: 'Cirurgia', internacao: 'Internação', banho_tosa: 'Banho & Tosa' };
const HISTORY_MONTHS = 12;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** Agenda (concluir/cancelar), atendimentos finalizados por mês (com o que foi usado) e cancelados. */
export default function AttendancesPage() {
  const { role, procedures, insumos, insumosMap, settings, flushPending } = useAnimaliaData();
  const months = useMemo(() => lastMonths(HISTORY_MONTHS), []);
  const categories = useMemo(() => CATEGORIES_BY_ROLE[role] ?? [], [role]);
  const [tab, setTab] = useState('agendado');
  const [month, setMonth] = useState(months[months.length - 1]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [itemsById, setItemsById] = useState(new Map());
  const [errorMsg, setErrorMsg] = useState('');
  const [message, setMessage] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [expanded, setExpanded] = useState(null);
  const [concluding, setConcluding] = useState(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(null);
  const today = todayISO();

  useEffect(() => {
    let active = true;
    fetchAttendances(`${months[0]}-01`)
      .then(async (data) => {
        if (!active) return;
        if (data === null) {
          setErrorMsg('A tabela de atendimentos ainda não existe no banco (falta rodar supabase/atendimentos.sql).');
          setRows([]);
          return;
        }
        setRows(data);
        const items = await fetchAttendanceItems(data.filter((row) => row.status === 'realizado').map((row) => row.id));
        if (active) setItemsById(items);
      })
      .catch((error) => active && setErrorMsg(error.message));
    return () => {
      active = false;
    };
  }, [months, reloadKey]);

  const mine = useMemo(() => (rows ?? []).filter((row) => !row.categoria || categories.includes(row.categoria)), [rows, categories]);
  const scheduledCount = mine.filter((row) => row.status === 'agendado').length;
  const lateCount = mine.filter((row) => row.status === 'agendado' && row.data_realizacao < today).length;

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mine
      .filter((row) => row.status === tab)
      .filter((row) => tab === 'agendado' || row.data_realizacao.slice(0, 7) === month)
      .filter((row) => !query || row.procedure_name?.toLowerCase().includes(query) || row.paciente?.toLowerCase().includes(query))
      .sort((a, b) => (tab === 'agendado'
        ? a.data_realizacao.localeCompare(b.data_realizacao)
        : b.data_realizacao.localeCompare(a.data_realizacao) || b.created_at.localeCompare(a.created_at)));
  }, [mine, tab, month, search]);

  const totals = useMemo(() => visible.reduce((sum, row) => ({
    count: sum.count + (row.quantidade || 1),
    revenue: sum.revenue + Number(row.valor_cobrado || 0),
    supplies: sum.supplies + (itemsById.get(row.id) ?? []).reduce((total, item) => total + item.cost, 0),
  }), { count: 0, revenue: 0, supplies: 0 }), [visible, itemsById]);

  const myProcedures = useMemo(() => procedures.filter((p) => categories.includes(p.category)), [procedures, categories]);
  const monthOptions = useMemo(() => [...months].reverse().map((m) => ({ value: m, label: capitalize(monthLabel(m)) })), [months]);

  const handleCancel = async (row) => {
    if (!(await confirmAction(`Cancelar o agendamento de "${row.procedure_name}" em ${formatDateBR(row.data_realizacao)}?`, 'Cancelar agendamento'))) return;
    setBusy(row.id);
    setMessage('');
    try {
      await cancelAttendance(row.id);
      setMessage(`Agendamento de ${row.procedure_name} cancelado.`);
      setReloadKey((key) => key + 1);
    } catch (error) {
      setMessage(error.message);
    }
    setBusy(null);
  };

  return (
    <View>
      <SectionHeader
        title="Atendimentos"
        description="Agenda do dia a dia, atendimentos finalizados (com o que foi gasto de verdade) e cancelados."
        action={<Button label="+ Novo atendimento" disabled={myProcedures.length === 0} onPress={() => { setMessage(''); setCreating(true); }} />}
      />

      <View style={styles.filters}>
        <Segmented
          options={TABS.map((item) => (item.value === 'agendado' && scheduledCount > 0 ? { ...item, label: `${item.label} (${scheduledCount})` } : item))}
          value={tab}
          onChange={(value) => { setTab(value); setExpanded(null); }}
        />
        <View style={styles.filterRow}>
          {tab !== 'agendado' && <Select value={month} options={monthOptions} onChange={setMonth} style={{ minWidth: 200 }} />}
          <Input placeholder="Buscar procedimento ou paciente" value={search} onChangeText={setSearch} style={{ flex: 1, minWidth: 200 }} />
        </View>
      </View>

      {message ? <Text style={styles.message}>{message}</Text> : null}
      <ErrorBanner message={errorMsg} />
      {rows === null && !errorMsg && <Text style={styles.muted}>Carregando atendimentos…</Text>}
      {rows !== null && tab === 'agendado' && lateCount > 0 && (
        <Text style={styles.warning}>{lateCount} agendamento(s) com data passada: conclua (se foi feito) ou cancele.</Text>
      )}

      {rows !== null && tab === 'realizado' && visible.length > 0 && (
        <View style={styles.kpis}>
          <Kpi label="Finalizados" value={String(totals.count)} hint={capitalize(monthLabel(month))} />
          <Kpi label="Valor cobrado" value={formatBRL(totals.revenue)} hint="Antes das taxas" />
          <Kpi label="Insumos usados" value={formatBRL(totals.supplies)} hint="Custo real dos lotes" />
        </View>
      )}

      {rows !== null && visible.length === 0 && (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>
            {tab === 'agendado'
              ? 'Nenhum atendimento agendado.'
              : tab === 'realizado' ? `Nenhum atendimento finalizado em ${monthLabel(month)}.` : `Nenhum cancelamento em ${monthLabel(month)}.`}
          </Text>
          <Text style={styles.muted}>Use “+ Novo atendimento” para registrar ou agendar.</Text>
        </View>
      )}

      <View style={styles.list}>
        {visible.map((row) => {
          const late = row.status === 'agendado' && row.data_realizacao < today;
          const items = itemsById.get(row.id) ?? [];
          const supplies = items.reduce((total, item) => total + item.cost, 0);
          const adjusted = row.observacao?.includes('Ajuste na ficha');
          const isOpen = expanded === row.id;
          return (
            <View key={row.id} style={styles.card}>
              <View style={styles.cardTop}>
                <View style={styles.dateBox}>
                  <Text style={[styles.date, late && styles.danger]}>{formatDateBR(row.data_realizacao)}</Text>
                  {late && <Text style={[styles.small, styles.danger]}>atrasado</Text>}
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={styles.name} numberOfLines={2}>{row.procedure_name}{row.quantidade > 1 ? ` (${row.quantidade}x)` : ''}</Text>
                  <View style={styles.metaRow}>
                    <Text style={styles.small}>{CATEGORY_LABEL[row.categoria] ?? ''}{row.paciente ? ` · ${row.paciente}` : ''}</Text>
                    {adjusted && <Text style={styles.tag}>ficha ajustada</Text>}
                  </View>
                </View>
                <View style={styles.valueBox}>
                  <Text style={styles.value}>{row.valor_cobrado != null ? formatBRL(Number(row.valor_cobrado)) : '—'}</Text>
                  {row.forma_pagamento ? <Text style={styles.small}>{row.forma_pagamento}</Text> : null}
                  {tab === 'realizado' && row.estoque_baixado && <Text style={styles.small}>insumos {formatBRL(supplies)}</Text>}
                </View>
              </View>

              <View style={styles.actions}>
                {tab === 'agendado' ? (
                  <>
                    <Button
                      small
                      variant="ghost"
                      label={row.data_realizacao > today ? 'Concluir (no dia)' : 'Concluir'}
                      disabled={busy != null || row.data_realizacao > today}
                      onPress={() => { setMessage(''); setConcluding(row); }}
                    />
                    <Button small variant="ghost" label="Cancelar" disabled={busy != null} onPress={() => handleCancel(row)} />
                  </>
                ) : (
                  <Button small variant="ghost" label={isOpen ? 'Fechar detalhes' : 'Detalhes'} onPress={() => setExpanded(isOpen ? null : row.id)} />
                )}
              </View>

              {isOpen && (
                <View style={styles.detail}>
                  {row.observacao ? <Text style={styles.detailText}><Text style={{ fontWeight: '700' }}>Observação: </Text>{row.observacao}</Text> : null}
                  {row.taxa_percentual != null && (
                    <Text style={styles.small}>Taxa da forma de pagamento no dia: {formatDecimal(Number(row.taxa_percentual), 2)}%</Text>
                  )}
                  {items.length > 0 ? items.map((item) => {
                    const insumo = insumosMap.get(item.insumoId);
                    return (
                      <View key={item.insumoId} style={styles.detailRow}>
                        <Text style={[styles.detailText, { flex: 1 }]} numberOfLines={2}>{insumo?.name ?? item.insumoId}</Text>
                        <Text style={styles.detailText}>{formatDecimal(item.quantity, 3)} {insumo?.unit}</Text>
                        <Text style={[styles.detailText, styles.detailCost]}>{formatBRL(item.cost)}</Text>
                      </View>
                    );
                  }) : <Text style={styles.small}>Nenhum item baixado do estoque neste atendimento.</Text>}
                </View>
              )}
            </View>
          );
        })}
      </View>

      {creating && (
        <ProcedureConsumeModal
          procedure={null}
          procedures={myProcedures}
          insumos={insumos}
          insumosMap={insumosMap}
          settings={settings}
          flushPending={flushPending}
          onClose={() => setCreating(false)}
          onDone={({ procedure, status, date }) => {
            setMessage(`✓ ${procedure.name}: ${status === 'agendado' ? 'agendado para' : 'registrado em'} ${formatDateBR(date)}.`);
            setCreating(false);
            setTab(status);
            if (status === 'realizado') setMonth(date.slice(0, 7));
            setReloadKey((key) => key + 1);
          }}
        />
      )}

      {concluding && (
        <ConcludeAttendanceModal
          attendance={concluding}
          procedure={procedures.find((p) => p.id === concluding.procedure_id)}
          insumos={insumos}
          insumosMap={insumosMap}
          onClose={() => setConcluding(null)}
          onDone={({ adjusted }) => {
            setMessage(`✓ ${concluding.procedure_name} finalizado e estoque baixado${adjusted ? ' (com ajuste na ficha)' : ''}.`);
            setConcluding(null);
            setReloadKey((key) => key + 1);
          }}
        />
      )}
    </View>
  );
}

function Kpi({ label, value, hint }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.kpiValue}>{value}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 10, marginBottom: 12 },
  filterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  message: { fontSize: 13, color: '#047857', marginBottom: 10 },
  warning: { fontSize: 13, color: COLORS.warning, marginBottom: 10 },
  muted: { fontSize: 13, color: COLORS.muted },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 12 },
  kpi: { flexGrow: 1, flexBasis: 180, padding: 14, gap: 2, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  empty: { alignItems: 'center', paddingVertical: 40, gap: 6, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderStyle: 'dashed', borderColor: COLORS.borderStrong },
  emptyTitle: { fontSize: 15, fontWeight: '600', color: COLORS.textSoft },
  list: { gap: 8 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, overflow: 'hidden' },
  cardTop: { flexDirection: 'row', gap: 12, padding: 14, alignItems: 'flex-start' },
  dateBox: { width: 84 },
  date: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  name: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 2 },
  small: { fontSize: 12, color: COLORS.muted },
  danger: { color: COLORS.danger },
  tag: { fontSize: 10, fontWeight: '700', color: '#B45309', backgroundColor: '#FEF3C7', paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, overflow: 'hidden' },
  valueBox: { alignItems: 'flex-end', maxWidth: 160 },
  value: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 2, paddingHorizontal: 8, paddingVertical: 4, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detail: { gap: 6, paddingHorizontal: 14, paddingVertical: 12, backgroundColor: COLORS.bg, borderTopWidth: 1, borderTopColor: '#F1F5F9' },
  detailRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  detailText: { fontSize: 13, color: COLORS.textSoft },
  detailCost: { width: 90, textAlign: 'right' },
});
