import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { fetchLots, isStockTracked, summarizeLots } from '../services/stockService';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { formatBRL, formatDecimal } from '../utils/costCalculations';
import { findAnomalies, forecastAhead, stockoutForecast } from '../utils/forecast';
import ForecastChart from './ForecastChart';
import { COLORS, ErrorBanner, NumberInput, SectionHeader, Segmented, Select, useIsWide } from './ui';

const MODES = [
  { value: 'real', label: 'Dados reais' },
  { value: 'demo', label: 'Demonstração (6 meses simulados)' },
];
const HISTORY_MONTHS = 7; // 6 meses fechados + o mês atual
const USAGE_WINDOW_DAYS = 30;
const FORECAST_OFFSETS = [1, 2, 3, 4]; // mês atual (em andamento) + 3 meses à frente

const addMonths = (key, count) => {
  const [y, m] = key.split('-').map(Number);
  return monthKey(new Date(y, m - 1 + count, 1));
};
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);
const pct = (value) => `${formatDecimal(value, 2)}%`;

function trendText(perMonth) {
  if (perMonth == null) return '—';
  if (Math.abs(perMonth) < 1) return 'estável';
  return `${perMonth > 0 ? 'de alta' : 'de queda'} (${perMonth > 0 ? '+' : '−'}${formatBRL(Math.abs(perMonth))}/mês)`;
}

/** Resultado do mês: DRE, taxas, projeção por regressão linear, estoque que vai acabar e anomalias. */
export default function ResultPage() {
  const { procedures, insumos, insumosMap, settings } = useAnimaliaData();
  const isWide = useIsWide(900);
  const months = useMemo(() => lastMonths(HISTORY_MONTHS), []);
  const [mode, setMode] = useState('real');
  const [month, setMonth] = useState(months[months.length - 1]);
  const [mix, setMix] = useState(DEFAULT_MIX);
  const [base, setBase] = useState(null);
  const [lots, setLots] = useState([]);
  const [bcb, setBcb] = useState({ state: 'loading' });
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let active = true;
    Promise.all([loadData(months), fetchLots()]).then(
      ([data, lotList]) => {
        if (!active) return;
        setBase(data);
        setLots(lotList);
      },
      (error) => active && setErrorMsg(error.message),
    );
    const controller = new AbortController();
    fetchBcbMdr({ signal: controller.signal }).then(
      (result) => active && setBcb({ state: 'ok', ...result }),
      (error) => active && error.name !== 'AbortError' && setBcb({ state: 'error', message: error.message }),
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

  const results = useMemo(() => {
    if (!base) return [];
    return months.map((m) => computeMonth({
      month: m, movements, attendances, fixedCosts: base.fixedCosts, fees, procedures, insumosMap, settings, mix,
    }));
  }, [base, months, movements, attendances, fees, procedures, insumosMap, settings, mix]);

  const current = results.find((r) => r.month === month);
  const closedMonths = results.slice(0, months.length - 1); // o mês atual ainda está em andamento
  // Regressão sobre os meses fechados; projeta o mês atual e os 3 seguintes
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

  const monthOptions = useMemo(() => [...months].reverse().map((m) => ({ value: m, label: capitalize(monthLabel(m)) })), [months]);
  const twoCols = isWide ? styles.twoCols : null;

  return (
    <View>
      <SectionHeader
        title="Resultado do mês"
        description="Quanto a clínica faturou, gastou e lucrou no mês, com base nos atendimentos registrados e nas baixas do estoque."
      />

      <View style={styles.filters}>
        <Segmented options={MODES} value={mode} onChange={setMode} />
        <Select value={month} options={monthOptions} onChange={setMonth} style={{ maxWidth: 260 }} />
      </View>

      {mode === 'demo' && (
        <Notice>Modo demonstração: 6 meses de atendimentos simulados só nesta tela, usando as fichas e preços reais da clínica. Nada é gravado no banco.</Notice>
      )}
      {tableMissing && (
        <Notice>A tabela de atendimentos ainda não existe no banco (falta rodar supabase/atendimentos.sql). Por enquanto a receita é estimada pelo preço da ficha.</Notice>
      )}
      {mode === 'real' && !tableMissing && current && (current.legacyCount > 0 || current.estimatedRevenueCount > 0) && (
        <Notice>
          Neste mês, {current.estimatedRevenueCount} atendimento(s) estão com a receita estimada pelo preço da ficha
          {current.legacyCount > 0 ? ` (${current.legacyCount} são baixas de estoque antigas, de antes do registro com data e valor)` : ' (valor cobrado não informado)'}.
        </Notice>
      )}
      <ErrorBanner message={errorMsg} />
      {!base && !errorMsg && <Text style={styles.muted}>Carregando os dados do mês…</Text>}

      {current && (
        <View style={{ gap: 14 }}>
          <View style={styles.kpis}>
            <Kpi label="Receita" value={formatBRL(current.revenue)} hint={`${current.count} atendimentos`} />
            <Kpi label="Margem de contribuição" value={formatBRL(current.contribution)} hint="Receita − custos variáveis" />
            <Kpi label="Custos fixos + perdas" value={formatBRL(current.fixed + current.losses)} hint="Estrutura do mês" />
            <Kpi
              label="Lucro do mês"
              value={formatBRL(current.profit)}
              tone={current.profit >= 0 ? 'good' : 'bad'}
              hint={current.breakEven != null ? `Equilíbrio: ${current.breakEven} atendimentos` : 'Sem atendimentos no mês'}
            />
          </View>

          <View style={twoCols}>
            <Card title={`Demonstrativo de ${monthLabel(month)}`} style={isWide && styles.col}>
              <DreRow
                label={current.estimatedRevenueCount === 0
                  ? 'Receita (valor cobrado nos atendimentos)'
                  : current.estimatedRevenueCount === current.attendances.length ? 'Receita (estimada pelo preço dos procedimentos)' : 'Receita (valor cobrado + estimativas)'}
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
              {current.breakEven != null && (
                <Text style={styles.muted}>
                  <Text style={styles.bold}>Ponto de equilíbrio:</Text> com a margem média deste mês, a clínica precisa de{' '}
                  <Text style={styles.bold}>{current.breakEven} atendimentos</Text> para pagar a estrutura. Foram {current.count}.
                </Text>
              )}
            </Card>

            <Card title="Formas de pagamento e taxas" style={isWide && styles.col}>
              <Text style={styles.muted}>
                Cada atendimento usa a taxa da forma em que foi pago: a cadastrada pela clínica em Custos e Taxas e, se não houver, a média
                nacional do Banco Central{bcb.state === 'ok' ? ` (${bcb.label})` : ''}. O mix estimado só vale para atendimentos sem forma informada.
              </Text>
              {PAYMENT_FORMS.map(({ key, label }) => {
                const fee = fees[key];
                const above = fee.clinic != null && fee.bcb != null && fee.clinic > fee.bcb;
                return (
                  <View key={key} style={styles.feeRow}>
                    <View style={{ flex: 1, minWidth: 150, gap: 2 }}>
                      <Text style={styles.bold}>{label}</Text>
                      <Text style={styles.small}>
                        Clínica: <Text style={above && styles.danger}>{fee.clinic != null ? pct(fee.clinic) : '—'}</Text>
                        {fee.rowCount > 1 ? ` (média de ${fee.rowCount})` : ''} · Média nacional: {fee.bcb != null ? pct(fee.bcb) : key === 'pix' ? 'não publicada' : '…'}
                      </Text>
                      <Text style={styles.small}>Pago no mês: {current.realMix ? pct(current.realMix[key]) : '—'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 6 }}>
                      <Text
                        style={[
                          styles.feeSource,
                          fee.source === 'clínica' ? styles.feeClinic : fee.source === 'Banco Central' ? styles.feeBcb : styles.feeNone,
                        ]}
                      >
                        {fee.source === 'sem taxa' ? 'sem taxa (0%)' : `${pct(fee.used)} · ${fee.source === 'clínica' ? 'clínica' : 'Banco Central'}`}
                      </Text>
                      <NumberInput min={0} max={100} suffix="% mix" value={mix[key]} onChange={(value) => setMix({ ...mix, [key]: value })} style={{ width: 120 }} />
                    </View>
                  </View>
                );
              })}
              {bcb.state === 'error' && <Text style={styles.dangerText}>Não foi possível consultar o Banco Central: {bcb.message}</Text>}
              {duplicateFees.length > 0 && (
                <Text style={styles.warning}>
                  Taxas repetidas em Custos e Taxas: {duplicateFees.map((dup) => `${dup.label} / ${dup.brand} (${dup.values.map((v) => pct(v)).join(' e ')})`).join('; ')}.
                  Usamos a média, mas o certo é deixar só uma por bandeira.
                </Text>
              )}
              {duplicateFees.length === 0 && multiBrand.length > 0 && (
                <Text style={styles.muted}>{multiBrand.map(({ label }) => label).join(', ')}: há taxas de bandeiras diferentes; usamos a média entre elas.</Text>
              )}
              {PAYMENT_FORMS.some(({ key }) => fees[key].clinic != null && fees[key].bcb != null && fees[key].clinic > fees[key].bcb) && (
                <Text style={styles.warning}>Em vermelho: taxas da clínica acima da média nacional. Vale renegociar com a maquininha.</Text>
              )}
            </Card>
          </View>

          <Card
            title="Projeção dos próximos 3 meses"
            badge="Machine learning · regressão linear"
            style={styles.mlCard}
          >
            {forecastRevenue && aheadRows.length > 0 ? (
              <>
                <Text style={styles.muted}>
                  O modelo aprende a tendência dos {trainMonths.length} meses fechados (mínimos quadrados) e a projeta para{' '}
                  {aheadRows.map((row) => monthLabel(row.month).split(' ')[0]).join(', ')}. A faixa sombreada é o intervalo de previsão de 95%: ela
                  abre quanto mais longe a projeção vai. A confiança mostra o quanto os meses seguem um padrão (r²).
                </Text>
                <View style={styles.kpis}>
                  <Kpi label="Atendimentos (3 meses)" value={formatDecimal(aheadTotal.count, 0)} hint={`Confiança ${forecastCount.confidence}`} />
                  <Kpi label="Receita prevista (3 meses)" value={formatBRL(aheadTotal.revenue)} hint={`Confiança ${forecastRevenue.confidence} (r² ${formatDecimal(forecastRevenue.r2, 2)})`} />
                  <Kpi
                    label="Lucro previsto (3 meses)"
                    value={formatBRL(aheadTotal.profit)}
                    tone={aheadTotal.profit >= 0 ? 'good' : 'bad'}
                    hint={`Tendência ${trendText(forecastProfit.trendPerMonth)}`}
                  />
                </View>
                <ForecastChart history={trainMonths} rows={forecastRows} />
                <View style={styles.table}>
                  {forecastRows.map((row) => (
                    <View key={row.month} style={[styles.forecastRow, row.isCurrent && styles.currentRow]}>
                      <View style={{ flexBasis: 150, flexGrow: 1 }}>
                        <Text style={[styles.bold, row.isCurrent && styles.mutedText]}>{capitalize(monthLabel(row.month))}</Text>
                        <Text style={styles.small}>
                          {row.isCurrent ? `mês atual · realizado até hoje: ${formatBRL(row.soFar?.revenue ?? 0)}` : `${formatDecimal(row.count.predicted, 0)} atendimentos previstos`}
                        </Text>
                      </View>
                      <ForecastValue label="Receita" point={row.revenue} muted={row.isCurrent} />
                      <ForecastValue label="Lucro" point={row.profit} muted={row.isCurrent} />
                      <View style={styles.forecastCell}>
                        <Text style={styles.small}>Já na agenda</Text>
                        <Text style={styles.cellValue}>{row.scheduledCount > 0 ? formatBRL(row.scheduledRevenue) : '—'}</Text>
                        {row.scheduledCount > 0 && (
                          <Text style={styles.small}>
                            {row.scheduledCount} agendado(s)
                            {row.revenue.predicted > 0 ? ` · ${formatDecimal(Math.min(100, (row.scheduledRevenue / row.revenue.predicted) * 100), 0)}%` : ''}
                          </Text>
                        )}
                      </View>
                    </View>
                  ))}
                </View>
              </>
            ) : (
              <Text style={styles.muted}>A previsão precisa de pelo menos 3 meses fechados com atendimentos. Use o modo Demonstração para ver como ela funciona.</Text>
            )}
            {current.month === months[months.length - 1] && current.scheduled.count > 0 && (
              <Text style={styles.scheduledLine}>
                <Text style={styles.bold}>Ainda neste mês:</Text> {current.scheduled.count} agendado(s), {formatBRL(current.scheduled.revenue)} — entram no resultado
                quando forem concluídos na aba Atendimentos.
              </Text>
            )}
          </Card>

          <View style={twoCols}>
            <Card title="Itens que devem acabar em breve" style={isWide && styles.col}>
              <Text style={styles.muted}>Pelo ritmo de consumo dos últimos {USAGE_WINDOW_DAYS} dias (regressão sobre o consumo acumulado).</Text>
              {stockouts.length === 0 ? (
                <Text style={styles.muted}>Nenhum item com risco de acabar nos próximos 45 dias.</Text>
              ) : stockouts.map((row) => (
                <View key={row.insumo.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cellText}>{row.insumo.name}</Text>
                    <Text style={styles.small}>
                      Saldo {formatDecimal(row.balance, 1)} {row.insumo.unit} · {formatDecimal(row.perDay, 2)} {row.insumo.unit}/dia
                    </Text>
                  </View>
                  <Text style={[styles.bold, row.daysLeft <= 15 && styles.danger]}>{row.daysLeft < 1 ? 'hoje' : `${Math.round(row.daysLeft)} dias`}</Text>
                </View>
              ))}
            </Card>

            <Card title="Atendimentos com custo fora do padrão" style={isWide && styles.col}>
              <Text style={styles.muted}>Detecção de anomalias: insumos gastos muito acima (ou abaixo) do previsto na ficha.</Text>
              {anomalies.length === 0 ? (
                <Text style={styles.muted}>Nenhum atendimento fora do padrão.</Text>
              ) : anomalies.map((row) => (
                <View key={row.id} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cellText}>{row.name}</Text>
                    <Text style={styles.small}>
                      {new Date(row.date).toLocaleDateString('pt-BR')} · previsto {formatBRL(row.expected)} · real {formatBRL(row.real)}
                    </Text>
                  </View>
                  <Text style={[styles.bold, row.deviation > 0 ? styles.danger : styles.good]}>
                    {row.deviation > 0 ? '+' : ''}{formatDecimal(row.deviation * 100, 0)}%
                  </Text>
                </View>
              ))}
            </Card>
          </View>

          {current.ranking.length > 0 && (
            <Card title="Procedimentos que mais deram resultado no mês">
              {current.ranking.slice(0, 8).map((row) => (
                <View key={row.name} style={styles.listRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.cellText}>{row.name}</Text>
                    <Text style={styles.small}>{row.count} atendimento(s) · receita {formatBRL(row.revenue)}</Text>
                  </View>
                  <Text style={[styles.bold, row.margin < 0 && styles.danger]}>{formatBRL(row.margin)}</Text>
                </View>
              ))}
            </Card>
          )}
        </View>
      )}
    </View>
  );
}

function Notice({ children }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeText}>{children}</Text>
    </View>
  );
}

function Card({ title, badge, children, style }) {
  return (
    <View style={[styles.card, style]}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function Kpi({ label, value, hint, tone }) {
  return (
    <View style={styles.kpi}>
      <Text style={styles.small}>{label}</Text>
      <Text style={[styles.kpiValue, tone === 'good' && styles.good, tone === 'bad' && styles.danger]}>{value}</Text>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
    </View>
  );
}

function DreRow({ label, value, strong, total }) {
  return (
    <View style={[styles.dreRow, total && styles.dreTotal]}>
      <Text style={[styles.cellText, { flex: 1 }, strong && styles.bold]}>{label}</Text>
      <Text style={[styles.cellText, strong && styles.bold, value < 0 && styles.danger]}>{formatBRL(value)}</Text>
    </View>
  );
}

function ForecastValue({ label, point, muted }) {
  return (
    <View style={styles.forecastCell}>
      <Text style={styles.small}>{label}</Text>
      <Text style={[styles.cellValue, point.predicted < 0 && styles.danger, muted && styles.mutedText]}>{formatBRL(point.predicted)}</Text>
      <Text style={styles.small}>{formatBRL(point.low)} a {formatBRL(point.high)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  filters: { gap: 10, marginBottom: 12 },
  notice: { padding: 12, marginBottom: 12, borderRadius: 10, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
  noticeText: { fontSize: 13, color: '#0C4A6E' },
  muted: { fontSize: 13, color: COLORS.muted, lineHeight: 19 },
  mutedText: { color: COLORS.muted },
  small: { fontSize: 12, color: COLORS.muted },
  bold: { fontWeight: '700', color: COLORS.text },
  danger: { color: COLORS.danger },
  dangerText: { fontSize: 13, color: COLORS.danger },
  good: { color: '#047857' },
  warning: { fontSize: 12, color: COLORS.warning },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  kpi: { flexGrow: 1, flexBasis: 180, padding: 14, gap: 2, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  kpiValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  twoCols: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  col: { flex: 1 },
  card: { padding: 16, gap: 10, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, marginBottom: 0 },
  mlCard: { borderColor: '#A7F3D0' },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy },
  badge: { fontSize: 11, fontWeight: '700', color: '#047857', backgroundColor: '#ECFDF5', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, overflow: 'hidden' },
  dreRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  dreTotal: { borderTopWidth: 2, borderTopColor: COLORS.navy, borderBottomWidth: 0 },
  cellText: { fontSize: 13, color: COLORS.textSoft },
  cellValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  feeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  feeSource: { fontSize: 12, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: 'hidden' },
  feeClinic: { color: '#047857', backgroundColor: '#ECFDF5' },
  feeBcb: { color: '#1D4ED8', backgroundColor: '#EFF6FF' },
  feeNone: { color: COLORS.muted, backgroundColor: '#F1F5F9' },
  table: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 10, overflow: 'hidden' },
  forecastRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, padding: 12, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  currentRow: { backgroundColor: '#FAFAF9' },
  forecastCell: { flexBasis: 130, flexGrow: 1, gap: 1 },
  scheduledLine: { fontSize: 13, color: COLORS.textSoft, padding: 10, backgroundColor: '#F8FAFC', borderLeftWidth: 3, borderLeftColor: '#0EA5E9', borderRadius: 6 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
});
