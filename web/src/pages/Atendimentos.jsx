import { useEffect, useMemo, useState } from 'react';
import ConcludeAttendanceModal from '../components/ConcludeAttendanceModal';
import ProcedureConsumeModal from '../components/ProcedureConsumeModal';
import { SectionHeader, Segmented } from '../components/ui';
import {
  cancelAttendance,
  fetchAttendanceItems,
  fetchAttendances,
  formatDateBR,
  todayISO,
} from '../services/attendanceService';
import { lastMonths, monthLabel } from '../services/monthlyResult';
import { useAuth } from '../store/AuthContext';
import { useData } from '../store/DataContext';
import { formatBRL, formatDecimal } from '../utils/costCalculations';

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

/** Lista de atendimentos: agenda (concluir/cancelar), finalizados por mês (com o que foi usado) e cancelados. */
export default function Atendimentos() {
  const { role } = useAuth();
  const { procedures, insumos, insumosMap, settings, flushPending } = useData();
  const months = useMemo(() => lastMonths(HISTORY_MONTHS), []);
  const categories = CATEGORIES_BY_ROLE[role] ?? [];
  const [tab, setTab] = useState('agendado');
  const [month, setMonth] = useState(months[months.length - 1]);
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState(null);
  const [itemsById, setItemsById] = useState(new Map());
  const [error, setError] = useState('');
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
          setError('A tabela de atendimentos ainda não existe no banco (falta rodar supabase/atendimentos.sql).');
          setRows([]);
          return;
        }
        setRows(data);
        const done = data.filter((row) => row.status === 'realizado').map((row) => row.id);
        const items = await fetchAttendanceItems(done);
        if (active) setItemsById(items);
      })
      .catch((loadError) => active && setError(loadError.message));
    return () => {
      active = false;
    };
  }, [months, reloadKey]);

  const mine = useMemo(
    () => (rows ?? []).filter((row) => !row.categoria || categories.includes(row.categoria)),
    [rows, categories],
  );
  const counts = useMemo(() => ({
    agendado: mine.filter((row) => row.status === 'agendado').length,
    late: mine.filter((row) => row.status === 'agendado' && row.data_realizacao < today).length,
  }), [mine, today]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return mine
      .filter((row) => row.status === tab)
      .filter((row) => tab === 'agendado' || row.data_realizacao.slice(0, 7) === month)
      .filter((row) => !query
        || row.procedure_name?.toLowerCase().includes(query)
        || row.paciente?.toLowerCase().includes(query))
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

  const handleCancel = async (row) => {
    if (!window.confirm(`Cancelar o agendamento de "${row.procedure_name}" em ${formatDateBR(row.data_realizacao)}?`)) return;
    setBusy(row.id);
    setMessage('');
    try {
      await cancelAttendance(row.id);
      setMessage(`Agendamento de ${row.procedure_name} cancelado.`);
      setReloadKey((key) => key + 1);
    } catch (cancelError) {
      setMessage(cancelError.message);
    }
    setBusy(null);
  };

  return (
    <>
      <SectionHeader
        title="Atendimentos"
        description="Agenda do dia a dia, atendimentos finalizados (com o que foi gasto de verdade) e cancelados."
        action={(
          <button type="button" className="btn btn-primary" disabled={myProcedures.length === 0} onClick={() => { setMessage(''); setCreating(true); }}>
            + Novo atendimento
          </button>
        )}
      />

      <div className="filters">
        <Segmented
          label="Situação"
          options={TABS.map((item) => (item.value === 'agendado' && counts.agendado > 0
            ? { ...item, label: `${item.label} (${counts.agendado})` }
            : item))}
          value={tab}
          onChange={(value) => { setTab(value); setExpanded(null); }}
        />
        {tab !== 'agendado' && (
          <select aria-label="Mês" value={month} onChange={(event) => setMonth(event.target.value)}>
            {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
          </select>
        )}
        <input type="search" aria-label="Buscar" placeholder="Buscar procedimento ou paciente" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {message && <p className="saved-text" role="status">{message}</p>}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {rows === null && !error && <p className="empty-text">Carregando atendimentos…</p>}

      {rows !== null && tab === 'agendado' && counts.late > 0 && (
        <p className="warning">{counts.late} agendamento(s) com data passada: conclua (se foi feito) ou cancele.</p>
      )}

      {rows !== null && tab === 'realizado' && visible.length > 0 && (
        <div className="result-kpis compact">
          <div className="card kpi"><small>Finalizados</small><strong>{totals.count}</strong><span>{monthLabel(month)}</span></div>
          <div className="card kpi"><small>Valor cobrado</small><strong>{formatBRL(totals.revenue)}</strong><span>Antes das taxas</span></div>
          <div className="card kpi"><small>Insumos usados</small><strong>{formatBRL(totals.supplies)}</strong><span>Custo real dos lotes</span></div>
        </div>
      )}

      {rows !== null && (visible.length === 0 ? (
        <div className="empty-box">
          <strong>
            {tab === 'agendado' ? 'Nenhum atendimento agendado.' : tab === 'realizado' ? `Nenhum atendimento finalizado em ${monthLabel(month)}.` : `Nenhum cancelamento em ${monthLabel(month)}.`}
          </strong>
          <span className="muted">Use “+ Novo atendimento” para registrar ou agendar.</span>
        </div>
      ) : (
        <div className="card attendance-list">
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Procedimento</th>
                  <th>Paciente</th>
                  <th className="right">Valor</th>
                  {tab === 'realizado' && <th className="right">Insumos</th>}
                  <th />
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const late = row.status === 'agendado' && row.data_realizacao < today;
                  const items = itemsById.get(row.id) ?? [];
                  const supplies = items.reduce((total, item) => total + item.cost, 0);
                  const adjusted = row.observacao?.includes('Ajuste na ficha');
                  const isOpen = expanded === row.id;
                  return [
                    <tr key={row.id} className={isOpen ? 'row-open' : ''}>
                      <td className={late ? 'danger-text' : ''}>
                        {formatDateBR(row.data_realizacao)}
                        {late && <small>atrasado</small>}
                      </td>
                      <td>
                        {row.procedure_name}{row.quantidade > 1 ? ` (${row.quantidade}x)` : ''}
                        <small>
                          {CATEGORY_LABEL[row.categoria] ?? ''}
                          {adjusted && <span className="item-tag-inline">ficha ajustada</span>}
                        </small>
                      </td>
                      <td>{row.paciente || '—'}</td>
                      <td className="right">
                        {row.valor_cobrado != null ? formatBRL(Number(row.valor_cobrado)) : '—'}
                        {row.forma_pagamento && <small>{row.forma_pagamento}</small>}
                      </td>
                      {tab === 'realizado' && <td className="right">{row.estoque_baixado ? formatBRL(supplies) : '—'}</td>}
                      <td className="right nowrap">
                        {tab === 'agendado' ? (
                          <>
                            <button
                              type="button"
                              className="btn btn-ghost btn-small"
                              disabled={busy != null || row.data_realizacao > today}
                              title={row.data_realizacao > today ? 'Só dá para concluir no dia ou depois' : undefined}
                              onClick={() => { setMessage(''); setConcluding(row); }}
                            >
                              Concluir
                            </button>
                            <button type="button" className="btn btn-ghost btn-small" disabled={busy != null} onClick={() => handleCancel(row)}>Cancelar</button>
                          </>
                        ) : (
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => setExpanded(isOpen ? null : row.id)} aria-expanded={isOpen}>
                            {isOpen ? 'Fechar' : 'Detalhes'}
                          </button>
                        )}
                      </td>
                    </tr>,
                    isOpen && (
                      <tr key={`${row.id}-detail`} className="row-detail">
                        <td colSpan={tab === 'realizado' ? 6 : 5}>
                          {row.observacao && <p><strong>Observação:</strong> {row.observacao}</p>}
                          {row.taxa_percentual != null && <p className="muted">Taxa da forma de pagamento no dia: {formatDecimal(Number(row.taxa_percentual), 2)}%</p>}
                          {items.length > 0 ? (
                            <table className="detail-items">
                              <thead><tr><th>Item usado</th><th className="right">Quantidade</th><th className="right">Custo</th></tr></thead>
                              <tbody>
                                {items.map((item) => {
                                  const insumo = insumosMap.get(item.insumoId);
                                  return (
                                    <tr key={item.insumoId}>
                                      <td>{insumo?.name ?? item.insumoId}</td>
                                      <td className="right">{formatDecimal(item.quantity, 3)} {insumo?.unit}</td>
                                      <td className="right">{formatBRL(item.cost)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          ) : (
                            <p className="muted">Nenhum item baixado do estoque neste atendimento.</p>
                          )}
                        </td>
                      </tr>
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

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
    </>
  );
}
