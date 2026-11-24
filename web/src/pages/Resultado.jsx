import { useEffect, useMemo, useState } from 'react';
import { NumberInput, SectionHeader } from '../components/ui';
import ConcludeAttendanceModal from '../components/ConcludeAttendanceModal';
import ForecastChart from '../components/ForecastChart';
import { cancelAttendance, formatDateBR, todayISO } from '../services/attendanceService';
import { fetchBcbMdr } from '../services/bcbTaxas';
import {
  computeMonth,
  dailyUsage,
  DEFAULT_MIX,
  lastMonths,
  loadData,
  monthKey,
  monthLabel,
  PAYMENT_FORMS,
  resolveFees,
} from '../services/monthlyResult';
import { fetchLots, isStockTracked, summarizeLots } from '../services/stockService';
import { useData } from '../store/DataContext';
import { formatBRL, formatDecimal } from '../utils/costCalculations';
import { findAnomalies, forecastAhead, stockoutForecast } from '../utils/forecast';

const EMPTY = [];
const HISTORY_MONTHS = 13; // 12 meses fechados (treino da previsão) + o mês atual
const CHART_MONTHS = 6; // meses fechados mostrados no gráfico
const USAGE_WINDOW_DAYS = 30;
const FORECAST_OFFSETS = [1, 2, 3, 4]; // mês atual (em andamento) + 3 meses à frente

/** Soma meses a uma chave AAAA-MM. */
const addMonths = (key, count) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + count, 1));
};

const pct = (value) => `${formatDecimal(value, 2)}%`;

export default function Resultado() {
  const { procedures, insumos, insumosMap, settings } = useData();
  const months = useMemo(() => lastMonths(HISTORY_MONTHS), []);
  const [month, setMonth] = useState(months[months.length - 1]);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [base, setBase] = useState(null); // { movements, fixedCosts, fees }
  const [lots, setLots] = useState([]);
  const [bcb, setBcb] = useState({ state: 'loading' });
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const [agendaBusy, setAgendaBusy] = useState(null);
  const [agendaMessage, setAgendaMessage] = useState('');
  const [concluding, setConcluding] = useState(null);

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

  // attendances = null quando a tabela de atendimentos ainda não existe no banco
  const movements = base ? base.movements : EMPTY;
  const attendances = base ? base.attendances : EMPTY;
  const tableMissing = base && base.attendances === null;

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

  // Agenda: agendados de hoje em diante (e os atrasados, que ainda não foram concluídos)
  const agenda = useMemo(() => (attendances ?? [])
    .filter((row) => row.status === 'agendado')
    .sort((a, b) => a.data_realizacao.localeCompare(b.data_realizacao)), [attendances]);
  const today = todayISO();

  const handleConclude = (row) => {
    setAgendaMessage('');
    setConcluding(row);
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
  // Regressão sobre os meses fechados; projeta o mês atual (em andamento) e os 3 seguintes
  const trainMonths = closedMonths.filter((r) => r.count > 0);
  const lastTrained = trainMonths[trainMonths.length - 1]?.month;
  const forecastRevenue = forecastAhead(trainMonths.map((r) => ({ month: r.month, value: r.revenue })), FORECAST_OFFSETS);
  const forecastProfit = forecastAhead(trainMonths.map((r) => ({ month: r.month, value: r.profit })), FORECAST_OFFSETS, { allowNegative: true });
  const forecastCount = forecastAhead(trainMonths.map((r) => ({ month: r.month, value: r.count })), FORECAST_OFFSETS);
  const forecastRows = forecastRevenue && lastTrained
    ? FORECAST_OFFSETS.map((offset, index) => {
      const key = addMonths(lastTrained, offset);
      const scheduledRows = (attendances ?? []).filter((row) => row.status === 'agendado' && row.data_realizacao.slice(0, 7) === key);
      return {
        month: key,
        isCurrent: key === months[months.length - 1],
        revenue: forecastRevenue.points[index],
        profit: forecastProfit.points[index],
        count: forecastCount.points[index],
        scheduledCount: scheduledRows.reduce((total, row) => total + (row.quantidade || 1), 0),
        scheduledRevenue: scheduledRows.reduce((total, row) => total + Number(row.valor_cobrado || 0), 0),
        soFar: results.find((r) => r.month === key) ?? null,
      };
    })
    : [];
  const aheadRows = forecastRows.filter((row) => !row.isCurrent).slice(0, 3);
  const aheadTotal = aheadRows.reduce((sum, row) => ({
    revenue: sum.revenue + row.revenue.predicted,
    profit: sum.profit + row.profit.predicted,
    count: sum.count + row.count.predicted,
  }), { revenue: 0, profit: 0, count: 0 });

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
        <select aria-label="Mês" value={month} onChange={(event) => setMonth(event.target.value)}>
          {[...months].reverse().map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
        </select>
      </div>

      {tableMissing && (
        <div className="notice-box">A tabela de atendimentos ainda não existe no banco (falta rodar <code>supabase/atendimentos.sql</code>). Por enquanto a receita é <strong>estimada</strong> pelo preço da ficha e cada baixa de estoque conta como um atendimento.</div>
      )}
      {!tableMissing && current && (current.legacyCount > 0 || current.estimatedRevenueCount > 0) && (
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
              <h2>Projeção dos próximos 3 meses</h2>
              <span className="badge">Machine learning · regressão linear</span>
            </div>
            {forecastRevenue && aheadRows.length > 0 ? (
              <>
                <p className="muted">
                  O modelo aprende a tendência dos {trainMonths.length} meses fechados (mínimos quadrados) e a projeta para {aheadRows.map((row) => monthLabel(row.month).split(' ')[0]).join(', ')}.
                  A faixa sombreada é o intervalo de previsão de 95%: ela abre quanto mais longe a projeção vai. A confiança mostra o quanto os meses seguem um padrão (r²).
                </p>
                <div className="result-kpis">
                  <Kpi label="Atendimentos (3 meses)" value={formatDecimal(aheadTotal.count, 0)} hint={`Confiança ${forecastCount.confidence}`} />
                  <Kpi label="Receita prevista (3 meses)" value={formatBRL(aheadTotal.revenue)} hint={`Confiança ${forecastRevenue.confidence} (r² ${formatDecimal(forecastRevenue.r2, 2)})`} />
                  <Kpi
                    label="Lucro previsto (3 meses)"
                    value={formatBRL(aheadTotal.profit)}
                    tone={aheadTotal.profit >= 0 ? 'good' : 'bad'}
                    hint={`Tendência ${trendText(forecastProfit.trendPerMonth)}`}
                  />
                </div>
                <ForecastChart history={trainMonths.slice(-CHART_MONTHS)} rows={forecastRows} />
                <div className="table-scroll">
                  <table className="forecast-table">
                    <thead>
                      <tr>
                        <th>Mês</th>
                        <th className="right">Atendimentos</th>
                        <th className="right">Receita prevista</th>
                        <th className="right">Lucro previsto</th>
                        <th className="right">Já na agenda</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastRows.map((row) => (
                        <tr key={row.month} className={row.isCurrent ? 'current-row' : ''}>
                          <td>
                            <span className="cap">{monthLabel(row.month)}</span>
                            {row.isCurrent && <small>mês atual · realizado até hoje: {formatBRL(row.soFar?.revenue ?? 0)}</small>}
                          </td>
                          <td className="right">{formatDecimal(row.count.predicted, 0)}</td>
                          <td className="right">
                            <strong>{formatBRL(row.revenue.predicted)}</strong>
                            <small>{formatBRL(row.revenue.low)} a {formatBRL(row.revenue.high)}</small>
                          </td>
                          <td className={`right ${row.profit.predicted < 0 ? 'danger-text' : ''}`}>
                            <strong>{formatBRL(row.profit.predicted)}</strong>
                            <small>{formatBRL(row.profit.low)} a {formatBRL(row.profit.high)}</small>
                          </td>
                          <td className="right">
                            {row.scheduledCount > 0 ? (
                              <>
                                {formatBRL(row.scheduledRevenue)}
                                <small>
                                  {row.scheduledCount} agendado(s)
                                  {row.revenue.predicted > 0 ? ` · ${formatDecimal(Math.min(100, (row.scheduledRevenue / row.revenue.predicted) * 100), 0)}% da previsão` : ''}
                                </small>
                              </>
                            ) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <p className="empty-text">
                A previsão precisa de pelo menos 3 meses fechados com atendimentos.
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
                Atendimentos marcados. Ao concluir, você confere o que foi usado (dá para ajustar a ficha) e o estoque é baixado.
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
                                disabled={agendaBusy != null || row.data_realizacao > today}
                                title={row.data_realizacao > today ? 'Só dá para concluir no dia ou depois' : undefined}
                                onClick={() => handleConclude(row)}
                              >
                                Concluir
                              </button>
                              <button type="button" className="btn btn-ghost btn-small" disabled={agendaBusy != null} onClick={() => handleCancel(row)}>
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

      {concluding && (
        <ConcludeAttendanceModal
          attendance={concluding}
          procedure={procedures.find((p) => p.id === concluding.procedure_id)}
          insumos={insumos}
          insumosMap={insumosMap}
          onClose={() => setConcluding(null)}
          onDone={({ adjusted }) => {
            setAgendaMessage(`✓ ${concluding.procedure_name} concluído e estoque baixado${adjusted ? ' (com ajuste na ficha)' : ''}.`);
            setConcluding(null);
            setReloadKey((key) => key + 1);
          }}
        />
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

