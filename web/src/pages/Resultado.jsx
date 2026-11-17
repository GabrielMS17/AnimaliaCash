import { useEffect, useMemo, useState } from 'react';
import { NumberInput, SectionHeader, Segmented } from '../components/ui';
import { cancelAttendance, concludeAttendance, formatDateBR, todayISO } from '../services/attendanceService';
import { fetchBcbMdr } from '../services/bcbTaxas';
import {
  computeMonth,
  dailyUsage,
  DEFAULT_MIX,
  generateDemoData,
  lastMonths,
  loadData,
  monthKey,
  monthLabel,
  PAYMENT_FORMS,
  resolveFees,
} from '../services/monthlyResult';
import { fetchLots, isStockTracked, procedureStockItems, summarizeLots } from '../services/stockService';
import { useData } from '../store/DataContext';
import { formatBRL, formatDecimal } from '../utils/costCalculations';
import { findAnomalies, forecastNext, stockoutForecast } from '../utils/forecast';

const MODES = [
  { value: 'real', label: 'Dados reais' },
  { value: 'demo', label: 'Demonstração (6 meses simulados)' },
];
const HISTORY_MONTHS = 7; // 6 meses fechados + o mês atual
const USAGE_WINDOW_DAYS = 30;

const pct = (value) => `${formatDecimal(value, 2)}%`;

export default function Resultado() {
  const { procedures, insumos, insumosMap, settings } = useData();
  const months = useMemo(() => lastMonths(HISTORY_MONTHS), []);
  const [mode, setMode] = useState('real');
  const [month, setMonth] = useState(months[months.length - 1]);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [base, setBase] = useState(null); // { movements, fixedCosts, fees }
  const [lots, setLots] = useState([]);
  const [bcb, setBcb] = useState({ state: 'loading' });
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [agendaBusy, setAgendaBusy] = useState(null);
  const [agendaMessage, setAgendaMessage] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([loadData(months), fetchLots()]).then(
      ([data, lotList]) => {
        if (!active) return;
        setBase(data);
        setLots(lotList);
      },
      (loadError) => active && setError(loadError.message),
    );
    return () => {
      active = false;
    };
  }, [months, reloadKey]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    fetchBcbMdr({ signal: controller.signal }).then(
      (result) => active && setBcb({ state: 'ok', ...result }),
      (bcbError) => active && bcbError.name !== 'AbortError' && setBcb({ state: 'error', message: bcbError.message }),
    );
    return () => {
      active = false;
      controller.abort();
    };
  }, [months]);

  const source = useMemo(() => {
    if (!base) return { movements: [], attendances: [] };
    if (mode === 'demo') return generateDemoData({ procedures, insumosMap, settings, months });
    return { movements: base.movements, attendances: base.attendances };
  }, [base, mode, procedures, insumosMap, settings, months]);
  const { movements, attendances } = source;
  const tableMissing = mode === 'real' && base && base.attendances === null;

  const fees = useMemo(() => resolveFees(base?.fees ?? [], bcb.state === 'ok' ? bcb.rates : null), [base, bcb]);
  const duplicateFees = PAYMENT_FORMS.flatMap(({ key, label }) => fees[key].duplicates.map((dup) => ({ label, ...dup })));
  const multiBrand = PAYMENT_FORMS.filter(({ key }) => fees[key].brands > 1);

  const nextMonth = useMemo(() => {
    const [y, m] = months[months.length - 1].split('-').map(Number);
    return monthKey(new Date(y, m, 1));
  }, [months]);

  const results = useMemo(() => {
    if (!base) return [];
    return [...months, nextMonth].map((m) => computeMonth({
      month: m, movements, attendances, fixedCosts: base.fixedCosts, fees, procedures, insumosMap, settings, mix,
    }));
  }, [base, months, nextMonth, movements, attendances, fees, procedures, insumosMap, settings, mix]);
  const nextResult = results.find((r) => r.month === nextMonth);

  // Agenda: agendados de hoje em diante (e os atrasados, que ainda não foram concluídos)
  const agenda = useMemo(() => (attendances ?? [])
    .filter((row) => row.status === 'agendado')
    .sort((a, b) => a.data_realizacao.localeCompare(b.data_realizacao)), [attendances]);
  const today = todayISO();

  const handleConclude = async (row) => {
    const procedure = procedures.find((p) => p.id === row.procedure_id);
    if (!window.confirm(`Concluir "${row.procedure_name}" com data de hoje? Os itens da ficha serão baixados do estoque.`)) return;
    setAgendaBusy(row.id);
    setAgendaMessage('');
    try {
      const items = procedure ? procedureStockItems(procedure, insumosMap, row.quantidade || 1) : [];
      await concludeAttendance({ id: row.id, date: today, items });
      setAgendaMessage(`✓ ${row.procedure_name} concluído e estoque baixado.`);
      setReloadKey((key) => key + 1);
    } catch (concludeError) {
      setAgendaMessage(concludeError.missing
        ? 'Estoque insuficiente para concluir. Dê entrada da compra no Estoque e tente de novo.'
        : concludeError.message);
    }
    setAgendaBusy(null);
  };

  const handleCancel = async (row) => {
    if (!window.confirm(`Cancelar o agendamento de "${row.procedure_name}" em ${formatDateBR(row.data_realizacao)}?`)) return;
    setAgendaBusy(row.id);
    setAgendaMessage('');
    try {
      await cancelAttendance(row.id);
      setAgendaMessage(`Agendamento de ${row.procedure_name} cancelado.`);
      setReloadKey((key) => key + 1);
    } catch (cancelError) {
      setAgendaMessage(cancelError.message);
    }
    setAgendaBusy(null);
  };

  const current = results.find((r) => r.month === month);
  const closedMonths = results.slice(0, months.length - 1); // o mês atual ainda está em andamento; o último é o mês que vem
  const forecastRevenue = forecastNext(closedMonths.filter((r) => r.count > 0).map((r) => ({ month: r.month, value: r.revenue })));
  const forecastProfit = forecastNext(closedMonths.filter((r) => r.count > 0).map((r) => ({ month: r.month, value: r.profit })), { allowNegative: true });
  const forecastCount = forecastNext(closedMonths.filter((r) => r.count > 0).map((r) => ({ month: r.month, value: r.count })));

  const stockouts = useMemo(() => {
    const usage = dailyUsage(movements, USAGE_WINDOW_DAYS);
    const stock = summarizeLots(lots);
    return insumos
      .filter((insumo) => isStockTracked(insumo) && usage.has(insumo.id))
      .map((insumo) => {
        const balance = stock.get(insumo.id)?.available ?? 0;
        const forecast = stockoutForecast(usage.get(insumo.id), balance, USAGE_WINDOW_DAYS);
        return forecast ? { insumo, balance, ...forecast } : null;
      })
      .filter((row) => row && row.daysLeft <= 45)
      .sort((a, b) => a.daysLeft - b.daysLeft)
      .slice(0, 8);
  }, [movements, lots, insumos]);

  const anomalies = useMemo(() => findAnomalies(
    results.flatMap((r) => r.attendances).filter((att) => att.stockTracked && att.realStockCost > 0).map((att) => ({
      id: att.id, name: att.procedureName, date: att.date, expected: att.expectedStockCost, real: att.realStockCost,
    })),
  ).slice(0, 6), [results]);

  return (
    <>
      <SectionHeader
        title="Resultado do mês"
        description="Quanto a clínica faturou, gastou e lucrou no mês, com base nos atendimentos registrados e nas baixas do estoque."
      />

      <div className="filters result-filters">
        <Segmented label="Origem dos dados" options={MODES} value={mode} onChange={setMode} />
        <select aria-label="Mês" value={month} onChange={(event) => setMonth(event.target.value)}>
          {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {mode === 'demo' && (
        <div className="notice-box">Modo demonstração: 6 meses de atendimentos <strong>simulados só nesta tela</strong> (com valor cobrado, forma de pagamento e agenda), usando as fichas e preços reais da clínica. Nada é gravado no banco.</div>
      )}
      {tableMissing && (
        <div className="notice-box">A tabela de atendimentos ainda não existe no banco (falta rodar <code>supabase/atendimentos.sql</code>). Por enquanto a receita é <strong>estimada</strong> pelo preço da ficha e cada baixa de estoque conta como um atendimento.</div>
      )}
      {mode === 'real' && !tableMissing && current && (current.legacyCount > 0 || current.estimatedRevenueCount > 0) && (
        <div className="notice-box">
          Neste mês, {current.estimatedRevenueCount} atendimento(s) estão com a <strong>receita estimada</strong> pelo preço da ficha
          {current.legacyCount > 0 ? ` (${current.legacyCount} são baixas de estoque antigas, de antes do registro com data e valor)` : ' (valor cobrado não informado)'}.
          Os demais usam o valor cobrado e a forma de pagamento registrados.
        </div>
      )}
      {error && <div className="error-banner" role="alert">{error}</div>}
      {!base && !error && <p className="empty-text">Carregando os dados do mês…</p>}

      {current && (
        <>
          <div className="result-kpis">
            <Kpi label="Receita" value={formatBRL(current.revenue)} hint={`${current.count} atendimentos`} />
            <Kpi label="Margem de contribuição" value={formatBRL(current.contribution)} hint="Receita − custos variáveis" />
            <Kpi label="Custos fixos + perdas" value={formatBRL(current.fixed + current.losses)} hint="Estrutura do mês" />
            <Kpi
              label="Lucro do mês"
              value={formatBRL(current.profit)}
              tone={current.profit >= 0 ? 'good' : 'bad'}
              hint={current.breakEven != null ? `Equilíbrio: ${current.breakEven} atendimentos` : 'Sem atendimentos no mês'}
            />
          </div>

          <div className="result-grid">
            <div className="card">
              <h2>Demonstrativo de {monthLabel(month)}</h2>
              <table className="dre">
                <tbody>
                  <DreRow
                    label={current.estimatedRevenueCount === 0
                      ? 'Receita (valor cobrado nos atendimentos)'
                      : current.estimatedRevenueCount === current.attendances.length
                        ? 'Receita (estimada pelo preço dos procedimentos)'
                        : 'Receita (valor cobrado + estimativas)'}
                    value={current.revenue}
                    strong
                  />
                  <DreRow label={`− Taxas de pagamento (${pct(current.feePercent)} da receita)`} value={-current.fees} />
                  <DreRow label="− Insumos consumidos (custo real dos lotes)" value={-current.supplies} />
                  <DreRow label="− Profissionais terceirizados" value={-current.external} />
                  <DreRow label="− Comissões" value={-current.commission} />
                  <DreRow label="= Margem de contribuição" value={current.contribution} strong />
                  <DreRow label="− Custos fixos" value={-current.fixed} />
                  <DreRow label="− Perdas do estoque (vencidos, quebras)" value={-current.losses} />
                  <DreRow label="= Lucro do mês" value={current.profit} strong total />
                </tbody>
              </table>
              {current.breakEven != null && (
                <p className="muted">
                  <strong>Ponto de equilíbrio:</strong> com a margem média deste mês, a clínica precisa de{' '}
                  <strong>{current.breakEven} atendimentos</strong> para pagar a estrutura. Foram {current.count}.
                </p>
              )}
            </div>

            <div className="card">
              <h2>Formas de pagamento e taxas</h2>
              <p className="muted">
                Cada atendimento usa a taxa da forma em que foi pago: a <strong>cadastrada pela clínica</strong> em Custos e Taxas e, se não houver,
                a média nacional do Banco Central{bcb.state === 'ok' ? ` (${bcb.label})` : ''}. O mix estimado só vale para atendimentos sem forma informada.
              </p>
              <div className="table-scroll">
                <table className="fees-table">
                  <thead>
                    <tr>
                      <th>Forma</th>
                      <th className="right">Pago no mês</th>
                      <th className="right">Mix estimado</th>
                      <th className="right">Taxa da clínica</th>
                      <th className="right">Média nacional</th>
                      <th>Usada no cálculo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PAYMENT_FORMS.map(({ key, label }) => {
                      const fee = fees[key];
                      const above = fee.clinic != null && fee.bcb != null && fee.clinic > fee.bcb;
                      return (
                        <tr key={key}>
                          <td>{label}</td>
                          <td className="right">{current.realMix ? pct(current.realMix[key]) : '—'}</td>
                          <td className="right">
                            <NumberInput min={0} max={100} suffix="%" label={`Percentual ${label}`} value={mix[key]} onChange={(value) => setMix({ ...mix, [key]: value })} className="w-tiny" />
                          </td>
                          <td className={`right ${above ? 'danger-text' : ''}`}>
                            {fee.clinic != null ? pct(fee.clinic) : '—'}
                            {fee.rowCount > 1 && <small className="block muted">média de {fee.rowCount}</small>}
                          </td>
                          <td className="right">{fee.bcb != null ? pct(fee.bcb) : key === 'pix' ? 'não publicada' : '…'}</td>
                          <td>
                            {fee.source === 'sem taxa' ? (
                              <span className="fee-source none">sem taxa (0%)</span>
                            ) : (
                              <span className={`fee-source ${fee.source === 'clínica' ? 'clinic' : 'bcb'}`}>
                                {pct(fee.used)} · {fee.source === 'clínica' ? 'clínica' : 'Banco Central'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {bcb.state === 'error' && <p className="error-text">Não foi possível consultar o Banco Central: {bcb.message}</p>}
              {duplicateFees.length > 0 && (
                <p className="warning">
                  Taxas repetidas em Custos e Taxas:{' '}
                  {duplicateFees.map((dup) => `${dup.label} / ${dup.brand} (${dup.values.map((v) => pct(v)).join(' e ')})`).join('; ')}.
                  Usamos a média, mas o certo é deixar só uma por bandeira.
                </p>
              )}
              {duplicateFees.length === 0 && multiBrand.length > 0 && (
                <p className="muted">
                  {multiBrand.map(({ label }) => label).join(', ')}: há taxas de bandeiras diferentes; usamos a média entre elas.
                </p>
              )}
              {PAYMENT_FORMS.some(({ key }) => fees[key].clinic != null && fees[key].bcb != null && fees[key].clinic > fees[key].bcb) && (
                <p className="warning">Em vermelho: taxas da clínica acima da média nacional. Vale renegociar com a maquininha.</p>
              )}
            </div>
          </div>

          <div className="card ml-card">
            <div className="ml-head">
              <h2>Previsão para o próximo mês</h2>
              <span className="badge">Machine learning · regressão linear</span>
            </div>
            {forecastRevenue ? (
              <>
                <p className="muted">
                  O modelo aprende a tendência dos meses fechados e projeta o próximo. A confiança mostra o quanto os meses seguem um padrão (r²).
                </p>
                <div className="result-kpis">
                  <Kpi label="Atendimentos previstos" value={formatDecimal(forecastCount?.predicted ?? 0, 0)} hint={`Confiança ${forecastCount?.confidence}`} />
                  <Kpi label="Receita prevista" value={formatBRL(forecastRevenue.predicted)} hint={`Confiança ${forecastRevenue.confidence} (r² ${formatDecimal(forecastRevenue.r2, 2)})`} />
                  <Kpi label="Lucro previsto" value={formatBRL(forecastProfit?.predicted ?? 0)} tone={(forecastProfit?.predicted ?? 0) >= 0 ? 'good' : 'bad'} hint={`Tendência ${trendText(forecastProfit?.trendPerMonth)}`} />
                </div>
                <TrendChart results={closedMonths} forecast={forecastRevenue} forecastProfit={forecastProfit} />
              </>
            ) : (
              <p className="empty-text">
                A previsão precisa de pelo menos 3 meses fechados com atendimentos. Use o modo <strong>Demonstração</strong> para ver como ela funciona.
              </p>
            )}
            {nextResult && nextResult.scheduled.count > 0 && (
              <p className="scheduled-line">
                <strong>Já agendados para {monthLabel(nextMonth)}:</strong> {nextResult.scheduled.count} atendimento(s), {formatBRL(nextResult.scheduled.revenue)} previstos
                {forecastRevenue && forecastRevenue.predicted > 0
                  ? ` — ${formatDecimal(Math.min(100, (nextResult.scheduled.revenue / forecastRevenue.predicted) * 100), 0)}% da receita prevista pelo modelo já está na agenda.`
                  : '.'}
              </p>
            )}
            {current.month === months[months.length - 1] && current.scheduled.count > 0 && (
              <p className="scheduled-line">
                <strong>Ainda neste mês:</strong> {current.scheduled.count} agendado(s), {formatBRL(current.scheduled.revenue)} — entram no resultado quando forem concluídos.
              </p>
            )}
          </div>

          {attendances && (
            <div className="card">
              <h2>Agenda</h2>
              <p className="muted">
                Atendimentos marcados. Ao concluir, o atendimento entra no resultado com a data de hoje e os itens da ficha são baixados do estoque.
                {mode === 'demo' ? ' (Na demonstração os botões ficam desativados.)' : ''}
              </p>
              {agendaMessage && <p className="saved-text" role="status">{agendaMessage}</p>}
              {agenda.length === 0 ? (
                <p className="empty-text">Nenhum atendimento agendado. Agende pelo botão “Registrar atendimento” nas telas de procedimentos.</p>
              ) : (
                <div className="table-scroll">
                  <table>
                    <thead><tr><th>Data</th><th>Procedimento</th><th>Paciente</th><th className="right">Valor</th><th /></tr></thead>
                    <tbody>
                      {agenda.slice(0, 15).map((row) => {
                        const late = row.data_realizacao < today;
                        return (
                          <tr key={row.id}>
                            <td className={late ? 'danger-text' : ''}>
                              {formatDateBR(row.data_realizacao)}
                              {late && <small className="block">atrasado</small>}
                            </td>
                            <td>{row.procedure_name}{row.quantidade > 1 ? ` (${row.quantidade}x)` : ''}</td>
                            <td>{row.paciente || '—'}</td>
                            <td className="right">{row.valor_cobrado != null ? formatBRL(Number(row.valor_cobrado)) : '—'}</td>
                            <td className="right nowrap">
                              <button
                                type="button"
                                className="btn btn-ghost btn-small"
                                disabled={mode === 'demo' || agendaBusy != null || row.data_realizacao > today}
                                title={row.data_realizacao > today ? 'Só dá para concluir no dia ou depois' : undefined}
                                onClick={() => handleConclude(row)}
                              >
                                Concluir
                              </button>
                              <button type="button" className="btn btn-ghost btn-small" disabled={mode === 'demo' || agendaBusy != null} onClick={() => handleCancel(row)}>
                                Cancelar
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {agenda.length > 15 && <p className="muted">E mais {agenda.length - 15} agendado(s).</p>}
                </div>
              )}
            </div>
          )}

          <div className="result-grid">
            <div className="card">
              <h2>Itens que devem acabar em breve</h2>
              <p className="muted">Pelo ritmo de consumo dos últimos {USAGE_WINDOW_DAYS} dias (regressão sobre o consumo acumulado).</p>
              {stockouts.length === 0 ? (
                <p className="empty-text">Nenhum item com risco de acabar nos próximos 45 dias.</p>
              ) : (
                <table>
                  <thead><tr><th>Item</th><th className="right">Saldo</th><th className="right">Consumo/dia</th><th className="right">Acaba em</th></tr></thead>
                  <tbody>
                    {stockouts.map((row) => (
                      <tr key={row.insumo.id}>
                        <td>{row.insumo.name}</td>
                        <td className="right">{formatDecimal(row.balance, 1)} {row.insumo.unit}</td>
                        <td className="right">{formatDecimal(row.perDay, 2)} {row.insumo.unit}</td>
                        <td className={`right ${row.daysLeft <= 15 ? 'danger-text' : ''}`}>
                          <strong>{row.daysLeft < 1 ? 'hoje' : `${Math.round(row.daysLeft)} dias`}</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="card">
              <h2>Atendimentos com custo fora do padrão</h2>
              <p className="muted">Detecção de anomalias: insumos gastos muito acima (ou abaixo) do previsto na ficha.</p>
              {anomalies.length === 0 ? (
                <p className="empty-text">Nenhum atendimento fora do padrão.</p>
              ) : (
                <table>
                  <thead><tr><th>Atendimento</th><th className="right">Previsto</th><th className="right">Real</th><th className="right">Diferença</th></tr></thead>
                  <tbody>
                    {anomalies.map((row) => (
                      <tr key={row.id}>
                        <td>{row.name}<small className="block muted">{new Date(row.date).toLocaleDateString('pt-BR')}</small></td>
                        <td className="right">{formatBRL(row.expected)}</td>
                        <td className="right">{formatBRL(row.real)}</td>
                        <td className={`right ${row.deviation > 0 ? 'danger-text' : 'positive-text'}`}>
                          <strong>{row.deviation > 0 ? '+' : ''}{formatDecimal(row.deviation * 100, 0)}%</strong>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {current.ranking.length > 0 && (
            <div className="card">
              <h2>Procedimentos que mais deram resultado no mês</h2>
              <table>
                <thead><tr><th>Procedimento</th><th className="right">Atendimentos</th><th className="right">Receita</th><th className="right">Margem</th></tr></thead>
                <tbody>
                  {current.ranking.slice(0, 8).map((row) => (
                    <tr key={row.name}>
                      <td>{row.name}</td>
                      <td className="right">{row.count}</td>
                      <td className="right">{formatBRL(row.revenue)}</td>
                      <td className={`right ${row.margin < 0 ? 'danger-text' : ''}`}><strong>{formatBRL(row.margin)}</strong></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}

function trendText(perMonth) {
  if (perMonth == null) return '—';
  if (Math.abs(perMonth) < 1) return 'estável';
  return `${perMonth > 0 ? 'de alta' : 'de queda'} (${perMonth > 0 ? '+' : '−'}${formatBRL(Math.abs(perMonth))}/mês)`;
}

function Kpi({ label, value, hint, tone }) {
  return (
    <div className={`card kpi ${tone ?? ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      {hint && <span>{hint}</span>}
    </div>
  );
}

function DreRow({ label, value, strong, total }) {
  return (
    <tr className={`${strong ? 'strong' : ''} ${total ? 'total' : ''}`}>
      <td>{label}</td>
      <td className={`right ${value < 0 ? 'danger-text' : ''}`}>{formatBRL(value)}</td>
    </tr>
  );
}

/** Gráfico simples: receita e lucro de cada mês fechado e a previsão do próximo (tracejada). */
function TrendChart({ results, forecast, forecastProfit }) {
  const width = 720;
  const height = 220;
  const pad = { left: 104, right: 24, top: 30, bottom: 34 };
  const points = results.map((r) => ({ label: r.month.slice(5) + '/' + r.month.slice(2, 4), revenue: r.revenue, profit: r.profit }));
  const all = [...points.map((p) => p.revenue), ...points.map((p) => p.profit), forecast.predicted, forecastProfit?.predicted ?? 0, 0];
  const max = Math.max(...all);
  const min = Math.min(...all);
  const n = points.length + 1;
  const x = (i) => pad.left + (i * (width - pad.left - pad.right)) / (n - 1);
  const y = (v) => pad.top + ((max - v) * (height - pad.top - pad.bottom)) / (max - min || 1);
  const line = (key) => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(p[key])}`).join(' ');
  const last = points.length - 1;

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Receita e lucro por mês, com a previsão do próximo mês">
      <line x1={pad.left} x2={width - pad.right} y1={y(0)} y2={y(0)} className="axis" />
      {[max, (max + min) / 2, min].map((v) => (
        <text key={v} x={pad.left - 8} y={y(v) + 4} textAnchor="end" className="tick">{formatBRL(v).replace(',00', '')}</text>
      ))}
      <path d={line('revenue')} className="series revenue" />
      <path d={line('profit')} className="series profit" />
      <path d={`M${x(last)},${y(points[last].revenue)} L${x(n - 1)},${y(forecast.predicted)}`} className="series revenue dashed" />
      {forecastProfit && <path d={`M${x(last)},${y(points[last].profit)} L${x(n - 1)},${y(forecastProfit.predicted)}`} className="series profit dashed" />}
      {points.map((p, i) => (
        <g key={p.label}>
          <circle cx={x(i)} cy={y(p.revenue)} r="4" className="dot revenue" />
          <circle cx={x(i)} cy={y(p.profit)} r="4" className="dot profit" />
          <text x={x(i)} y={height - 12} textAnchor="middle" className="tick">{p.label}</text>
        </g>
      ))}
      <circle cx={x(n - 1)} cy={y(forecast.predicted)} r="5" className="dot revenue hollow" />
      {forecastProfit && <circle cx={x(n - 1)} cy={y(forecastProfit.predicted)} r="5" className="dot profit hollow" />}
      <text x={x(n - 1)} y={height - 12} textAnchor="middle" className="tick strong">previsão</text>
      <g className="legend" transform={`translate(${width - pad.right - 170}, 12)`}>
        <circle cx="6" cy="0" r="5" className="dot revenue" /><text x="16" y="4">Receita</text>
        <circle cx="86" cy="0" r="5" className="dot profit" /><text x="96" y="4">Lucro</text>
      </g>
    </svg>
  );
}
