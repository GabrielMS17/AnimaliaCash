import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Polygon, Rect, Text as SvgText } from 'react-native-svg';
import { formatBRL } from '../utils/costCalculations';
import { COLORS } from './ui';

// Cores validadas para daltonismo (azul e verde-água, separação ΔE > 20)
const COLOR = { revenue: '#2A78D6', profit: '#1BAF7A' };
// Fonte sem serifa dentro do SVG (o padrão do navegador é serifado)
const FONT = Platform.select({ ios: 'System', android: 'sans-serif', default: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif' });
const HEIGHT = 300;
const PAD = { left: 64, right: 92, top: 30, bottom: 36 };
const SERIES = [
  { key: 'revenue', label: 'Receita' },
  { key: 'profit', label: 'Lucro' },
];

const monthName = (key, style) => {
  const [y, m] = key.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: style, year: style === 'long' ? 'numeric' : undefined });
};
const shortMonth = (key) => `${monthName(key, 'short').replace('.', '')}/${key.slice(2, 4)}`;
const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** "R$ 40 mil": rótulo curto para o eixo. */
const compactBRL = (value) => {
  if (Math.abs(value) >= 1000) {
    const thousands = Math.abs(value) / 1000;
    const text = Number.isInteger(thousands) ? String(thousands) : thousands.toFixed(1).replace('.', ',');
    return `${value < 0 ? '-' : ''}R$ ${text} mil`;
  }
  return formatBRL(value).replace(',00', '');
};

/** Marcas "redondas" para o eixo (passo de 1, 2 ou 5 × 10^k). */
function niceTicks(min, max, count = 5) {
  const raw = (max - min || 1) / (count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * power).find((s) => s >= raw);
  const ticks = [];
  for (let v = Math.floor(min / step) * step; v <= Math.ceil(max / step) * step + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/**
 * Receita e lucro: meses fechados (linha cheia) e projeção da regressão linear (tracejada),
 * com a faixa do intervalo de previsão de 95%. Toque num mês para ver os valores.
 * history: resultados mensais fechados; rows: projeções (mês atual + próximos).
 */
export default function ForecastChart({ history, rows }) {
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState(null);

  const columns = [
    ...history.map((r) => ({ month: r.month, kind: 'real', revenue: r.revenue, profit: r.profit })),
    ...rows.map((row) => ({
      month: row.month,
      kind: row.isCurrent ? 'current' : 'forecast',
      revenue: row.revenue.predicted,
      profit: row.profit.predicted,
      band: { revenue: row.revenue, profit: row.profit },
    })),
  ];
  const lastReal = history.length - 1;

  // Largura mínima: no celular o gráfico rola para o lado em vez de espremer
  const chartWidth = Math.max(width, 560);
  const values = columns.flatMap((c) => [c.revenue, c.profit, c.band?.revenue.low, c.band?.revenue.high, c.band?.profit.low, c.band?.profit.high])
    .filter((v) => v != null);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values));
  const min = ticks[0];
  const max = ticks[ticks.length - 1];
  const innerW = chartWidth - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const step = innerW / Math.max(1, columns.length - 1);
  const x = (i) => PAD.left + i * step;
  const y = (v) => PAD.top + ((max - v) * innerH) / (max - min || 1);

  const path = (key, from, to) => columns.slice(from, to + 1)
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${x(from + i).toFixed(1)},${y(c[key]).toFixed(1)}`).join(' ');
  const band = (key) => {
    const projected = columns.slice(lastReal + 1);
    const top = [`${x(lastReal)},${y(columns[lastReal][key])}`, ...projected.map((c, i) => `${x(lastReal + 1 + i)},${y(c.band[key].high)}`)];
    const bottom = projected.map((c, i) => `${x(lastReal + 1 + i)},${y(c.band[key].low)}`).reverse();
    return [...top, ...bottom].join(' ');
  };
  const base = y(Math.max(min, 0));
  const revenueArea = `${path('revenue', 0, lastReal)} L${x(lastReal)},${base} L${x(0)},${base} Z`;

  // Rótulos diretos no fim das linhas, sem sobrepor
  const lastCol = columns[columns.length - 1];
  let labelY = { revenue: y(lastCol.revenue), profit: y(lastCol.profit) };
  if (Math.abs(labelY.revenue - labelY.profit) < 30) {
    const mid = (labelY.revenue + labelY.profit) / 2;
    labelY = labelY.revenue < labelY.profit ? { revenue: mid - 15, profit: mid + 15 } : { revenue: mid + 15, profit: mid - 15 };
  }

  const picked = selected != null ? columns[selected] : null;

  return (
    <View style={styles.wrap}>
      <View style={styles.legend}>
        <LegendItem color={COLOR.revenue} label="Receita" />
        <LegendItem color={COLOR.profit} label="Lucro" />
        <Text style={styles.legendKey}>— realizado   - - projeção</Text>
        <View style={styles.legendBand}><View style={styles.bandSwatch} /><Text style={styles.legendKey}>faixa de 95%</Text></View>
      </View>

      <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        {width > 0 && (
          <View style={{ overflow: 'hidden' }}>
            <ScrollableChart width={width} chartWidth={chartWidth}>
              <Svg width={chartWidth} height={HEIGHT}>
                {ticks.map((t) => (
                  <G key={t}>
                    <Line x1={PAD.left} x2={chartWidth - PAD.right} y1={y(t)} y2={y(t)} stroke={t === 0 ? '#A8A29E' : '#E7E5E4'} strokeWidth={1} />
                    <SvgText fontFamily={FONT} x={PAD.left - 8} y={y(t) + 4} fontSize={11} fill={COLORS.muted} textAnchor="end">{compactBRL(t)}</SvgText>
                  </G>
                ))}

                <Rect x={x(lastReal)} y={PAD.top} width={x(columns.length - 1) - x(lastReal)} height={innerH} fill="#F5F7FB" />
                <Line x1={x(lastReal)} x2={x(lastReal)} y1={PAD.top - 6} y2={PAD.top + innerH} stroke="#A8A29E" strokeWidth={1} strokeDasharray="3 3" />
                <SvgText fontFamily={FONT} x={x(lastReal) + 8} y={PAD.top - 12} fontSize={11} fontWeight="700" fill={COLORS.text}>Projeção →</SvgText>
                <SvgText fontFamily={FONT} x={x(lastReal) - 8} y={PAD.top - 12} fontSize={11} fontWeight="600" fill={COLORS.muted} textAnchor="end">← Realizado</SvgText>

                <Path d={revenueArea} fill={COLOR.revenue} opacity={0.07} />
                <Polygon points={band('revenue')} fill={COLOR.revenue} opacity={0.14} />
                <Polygon points={band('profit')} fill={COLOR.profit} opacity={0.16} />

                {SERIES.map(({ key }) => (
                  <G key={key}>
                    <Path d={path(key, 0, lastReal)} stroke={COLOR[key]} strokeWidth={2.5} fill="none" strokeLinejoin="round" strokeLinecap="round" />
                    <Path d={path(key, lastReal, columns.length - 1)} stroke={COLOR[key]} strokeWidth={2.5} fill="none" strokeDasharray="7 5" strokeLinecap="round" />
                  </G>
                ))}

                {selected != null && (
                  <Line x1={x(selected)} x2={x(selected)} y1={PAD.top} y2={PAD.top + innerH} stroke="#78716C" strokeWidth={1} strokeDasharray="2 3" />
                )}

                {columns.map((c, i) => (
                  <G key={c.month}>
                    {SERIES.map(({ key }) => (
                      <Circle
                        key={key}
                        cx={x(i)}
                        cy={y(c[key])}
                        r={selected === i ? 6 : 4}
                        fill={c.kind === 'real' ? COLOR[key] : '#FFFFFF'}
                        stroke={c.kind === 'real' ? '#FFFFFF' : COLOR[key]}
                        strokeWidth={c.kind === 'real' ? 2 : 2.5}
                      />
                    ))}
                    <SvgText
                      fontFamily={FONT}
                      x={x(i)}
                      y={HEIGHT - 12}
                      fontSize={11}
                      fontWeight={c.kind === 'real' ? '400' : '600'}
                      fill={c.kind === 'real' ? COLORS.muted : COLORS.text}
                      textAnchor="middle"
                    >
                      {shortMonth(c.month)}
                    </SvgText>
                  </G>
                ))}

                {SERIES.map(({ key, label }) => (
                  <G key={key}>
                    <SvgText fontFamily={FONT} x={x(columns.length - 1) + 12} y={labelY[key] - 2} fontSize={12} fontWeight="700" fill={COLORS.text}>{label}</SvgText>
                    <SvgText fontFamily={FONT} x={x(columns.length - 1) + 12} y={labelY[key] + 13} fontSize={12} fill={COLORS.muted}>{compactBRL(lastCol[key])}</SvgText>
                  </G>
                ))}

                {/* Áreas de toque, maiores que os pontos */}
                {columns.map((c, i) => (
                  <Rect
                    key={`hit-${c.month}`}
                    x={x(i) - step / 2}
                    y={PAD.top}
                    width={step}
                    height={innerH}
                    fill="transparent"
                    onPress={() => setSelected(selected === i ? null : i)}
                  />
                ))}
              </Svg>
            </ScrollableChart>
          </View>
        )}
      </View>

      {picked ? (
        <Pressable onPress={() => setSelected(null)} style={styles.tooltip}>
          <Text style={styles.tipTitle}>{capitalize(monthName(picked.month, 'long'))}</Text>
          <Text style={styles.tipKind}>{picked.kind === 'real' ? 'Realizado' : picked.kind === 'current' ? 'Mês atual · projeção' : 'Projeção'}</Text>
          {SERIES.map(({ key, label }) => (
            <View key={key} style={styles.tipRow}>
              <View style={[styles.dot, { backgroundColor: COLOR[key] }]} />
              <Text style={styles.tipLabel}>{label}</Text>
              <Text style={styles.tipValue}>{formatBRL(picked[key])}</Text>
              {picked.band && <Text style={styles.tipRange}>{formatBRL(picked.band[key].low)} a {formatBRL(picked.band[key].high)}</Text>}
            </View>
          ))}
        </Pressable>
      ) : (
        <Text style={styles.hint}>Toque em um mês do gráfico para ver os valores.</Text>
      )}
    </View>
  );
}

/** No celular, o gráfico mais largo que a tela rola para o lado. */
function ScrollableChart({ width, chartWidth, children }) {
  if (chartWidth <= width) return children;
  return <ScrollView horizontal showsHorizontalScrollIndicator>{children}</ScrollView>;
}

function LegendItem({ color, label }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={styles.legendLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginVertical: 8 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, rowGap: 4 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendLabel: { fontSize: 12, color: COLORS.text },
  legendKey: { fontSize: 12, color: COLORS.muted },
  legendBand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bandSwatch: { width: 16, height: 10, borderRadius: 3, backgroundColor: 'rgba(42, 120, 214, 0.16)' },
  dot: { width: 10, height: 10, borderRadius: 5 },
  hint: { fontSize: 12, color: COLORS.muted },
  tooltip: { padding: 12, gap: 4, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card },
  tipTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  tipKind: { fontSize: 12, color: COLORS.muted, marginBottom: 2 },
  tipRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  tipLabel: { fontSize: 13, color: COLORS.textSoft, flex: 1 },
  tipValue: { fontSize: 13, fontWeight: '700', color: COLORS.text },
  tipRange: { width: '100%', fontSize: 11, color: COLORS.muted, paddingLeft: 18 },
});
