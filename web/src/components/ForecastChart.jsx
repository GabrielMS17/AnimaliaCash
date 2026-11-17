import { useState } from 'react';
import { formatBRL } from '../utils/costCalculations';

const WIDTH = 760;
const HEIGHT = 320;
const PAD = { left: 76, right: 112, top: 28, bottom: 40 };

const SERIES = [
  { key: 'revenue', label: 'Receita' },
  { key: 'profit', label: 'Lucro' },
];

const shortMonth = (key) => {
  const [y, m] = key.split('-').map(Number);
  return `${new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}/${String(y).slice(2)}`;
};

/** "R$ 40 mil", "-R$ 5 mil": rótulo curto para o eixo. */
const compactBRL = (value) => {
  if (Math.abs(value) >= 1000) {
    const thousands = value / 1000;
    const text = Number.isInteger(thousands) ? thousands : thousands.toFixed(1).replace('.', ',');
    return `${value < 0 ? '-' : ''}R$ ${String(text).replace('-', '')} mil`;
  }
  return formatBRL(value).replace(',00', '');
};

/** Marcas "redondas" para o eixo (passo de 1, 2 ou 5 × 10^k). */
function niceTicks(min, max, count = 5) {
  const span = max - min || 1;
  const raw = span / (count - 1);
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * power).find((s) => s >= raw);
  const start = Math.floor(min / step) * step;
  const end = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = start; v <= end + step / 2; v += step) ticks.push(Math.round(v));
  return ticks;
}

/**
 * Receita e lucro: meses fechados (linha cheia) e projeção da regressão linear (tracejada),
 * com a faixa do intervalo de previsão de 95%. Passe o mouse para ver os valores de cada mês.
 * history: resultados mensais fechados; rows: projeções (mês atual + próximos).
 */
export default function ForecastChart({ history, rows }) {
  const [hover, setHover] = useState(null);

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

  const values = columns.flatMap((c) => [c.revenue, c.profit, c.band?.revenue.low, c.band?.revenue.high, c.band?.profit.low, c.band?.profit.high])
    .filter((v) => v != null);
  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values));
  const min = ticks[0];
  const max = ticks[ticks.length - 1];

  const innerW = WIDTH - PAD.left - PAD.right;
  const innerH = HEIGHT - PAD.top - PAD.bottom;
  const step = innerW / Math.max(1, columns.length - 1);
  const x = (i) => PAD.left + i * step;
  const y = (v) => PAD.top + ((max - v) * innerH) / (max - min || 1);

  const path = (key, from, to) => columns.slice(from, to + 1)
    .map((c, i) => `${i === 0 ? 'M' : 'L'}${x(from + i).toFixed(1)},${y(c[key]).toFixed(1)}`).join(' ');

  // Faixa de 95%: começa no último mês real (largura zero) e abre nos meses projetados
  const band = (key) => {
    const anchor = columns[lastReal];
    const projected = columns.slice(lastReal + 1);
    const top = [`${x(lastReal)},${y(anchor[key])}`, ...projected.map((c, i) => `${x(lastReal + 1 + i)},${y(c.band[key].high)}`)];
    const bottom = [...projected.map((c, i) => `${x(lastReal + 1 + i)},${y(c.band[key].low)}`)].reverse();
    return [...top, ...bottom].join(' ');
  };

  // Área suave sob a receita real
  const revenueArea = `${path('revenue', 0, lastReal)} L${x(lastReal)},${y(Math.max(min, 0))} L${x(0)},${y(Math.max(min, 0))} Z`;

  // Rótulos diretos no fim das linhas, sem sobrepor
  const lastCol = columns[columns.length - 1];
  let labelY = { revenue: y(lastCol.revenue), profit: y(lastCol.profit) };
  if (Math.abs(labelY.revenue - labelY.profit) < 30) {
    const mid = (labelY.revenue + labelY.profit) / 2;
    labelY = labelY.revenue < labelY.profit
      ? { revenue: mid - 15, profit: mid + 15 }
      : { revenue: mid + 15, profit: mid - 15 };
  }

  const hovered = hover != null ? columns[hover] : null;
  const tooltipLeft = hover != null ? (x(hover) / WIDTH) * 100 : 0;

  return (
    <figure className="forecast-chart">
      <div className="chart-legend" aria-hidden="true">
        <span><i className="swatch revenue" />Receita</span>
        <span><i className="swatch profit" />Lucro</span>
        <span className="legend-key"><i className="line-solid" />realizado</span>
        <span className="legend-key"><i className="line-dashed" />projeção</span>
        <span className="legend-key"><i className="band-swatch" />faixa de 95%</span>
      </div>

      <div className="chart-wrap" onMouseLeave={() => setHover(null)}>
        <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Receita e lucro por mês: meses realizados e projeção dos próximos meses com faixa de confiança">
          {/* Grade e eixo */}
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(t)} y2={y(t)} className={t === 0 ? 'zero-line' : 'grid-line'} />
              <text x={PAD.left - 10} y={y(t) + 4} textAnchor="end" className="tick">{compactBRL(t)}</text>
            </g>
          ))}

          {/* Região projetada */}
          <rect x={x(lastReal)} y={PAD.top} width={x(columns.length - 1) - x(lastReal)} height={innerH} className="forecast-zone" />
          <line x1={x(lastReal)} x2={x(lastReal)} y1={PAD.top - 6} y2={PAD.top + innerH} className="divider" />
          <text x={x(lastReal) + 8} y={PAD.top - 10} className="zone-label">Projeção →</text>
          <text x={x(lastReal) - 8} y={PAD.top - 10} textAnchor="end" className="zone-label muted-label">← Realizado</text>

          <path d={revenueArea} className="area revenue" />
          <polygon points={band('revenue')} className="band revenue" />
          <polygon points={band('profit')} className="band profit" />

          {SERIES.map(({ key }) => (
            <g key={key}>
              <path d={path(key, 0, lastReal)} className={`series ${key}`} />
              <path d={path(key, lastReal, columns.length - 1)} className={`series ${key} dashed`} />
            </g>
          ))}

          {/* Marcadores: cheios = realizado; vazados = projeção */}
          {columns.map((c, i) => (
            <g key={c.month}>
              {SERIES.map(({ key }) => (
                <circle
                  key={key}
                  cx={x(i)}
                  cy={y(c[key])}
                  r={hover === i ? 6 : 4}
                  className={`marker ${key} ${c.kind === 'real' ? '' : 'hollow'}`}
                />
              ))}
              <text x={x(i)} y={HEIGHT - 14} textAnchor="middle" className={`tick ${c.kind !== 'real' ? 'tick-forecast' : ''}`}>
                {shortMonth(c.month)}
              </text>
            </g>
          ))}

          {/* Rótulos diretos */}
          {SERIES.map(({ key, label }) => (
            <g key={key} transform={`translate(${x(columns.length - 1) + 12}, ${labelY[key]})`}>
              <text className="end-label" y="-2">{label}</text>
              <text className="end-value" y="13">{compactBRL(lastCol[key])}</text>
            </g>
          ))}

          {/* Cruz de leitura */}
          {hover != null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} className="crosshair" />}

          {/* Áreas de captura do mouse (maiores que os pontos) */}
          {columns.map((c, i) => (
            <rect
              key={c.month}
              x={x(i) - step / 2}
              y={PAD.top}
              width={step}
              height={innerH}
              className="hit"
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </svg>

        {hovered && (
          <div className={`chart-tooltip ${tooltipLeft > 60 ? 'left' : ''}`} style={{ left: `${tooltipLeft}%` }} role="status">
            <strong className="cap">
              {new Date(Number(hovered.month.slice(0, 4)), Number(hovered.month.slice(5)) - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </strong>
            <span className="tip-kind">
              {hovered.kind === 'real' ? 'Realizado' : hovered.kind === 'current' ? 'Mês atual · projeção' : 'Projeção'}
            </span>
            {SERIES.map(({ key, label }) => (
              <div key={key} className="tip-row">
                <i className={`swatch ${key}`} />
                <span>{label}</span>
                <b>{formatBRL(hovered[key])}</b>
                {hovered.band && <small>{formatBRL(hovered.band[key].low)} a {formatBRL(hovered.band[key].high)}</small>}
              </div>
            ))}
          </div>
        )}
      </div>
    </figure>
  );
}
