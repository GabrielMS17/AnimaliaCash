// Aprendizado de máquina simples, rodando no próprio navegador:
// - regressão linear (mínimos quadrados) para prever o próximo mês e o ritmo de consumo do estoque
// - detecção de anomalias por escore-z para achar atendimentos com custo fora do padrão

/** Ajusta y = a + b·x pelos mínimos quadrados. Retorna { slope, intercept, r2, predict }. */
export function linearRegression(points) {
  const n = points.length;
  if (n < 2) return null;
  const meanX = points.reduce((sum, p) => sum + p.x, 0) / n;
  const meanY = points.reduce((sum, p) => sum + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  points.forEach((p) => {
    sxy += (p.x - meanX) * (p.y - meanY);
    sxx += (p.x - meanX) ** 2;
    syy += (p.y - meanY) ** 2;
  });
  const slope = sxx === 0 ? 0 : sxy / sxx;
  const intercept = meanY - slope * meanX;
  // r² = quanto da variação dos dados a reta explica (1 = perfeito, 0 = nada)
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { slope, intercept, r2, predict: (x) => intercept + slope * x };
}

/** Confiança, em palavras, a partir do r² e da quantidade de meses. */
export function confidenceLabel(r2, size) {
  if (size < 3) return 'insuficiente';
  if (r2 >= 0.7) return 'alta';
  if (r2 >= 0.4) return 'média';
  return 'baixa';
}

/**
 * Prevê o próximo valor de uma série mensal (ex: receita de cada mês).
 * series: [{ month: '2026-06', value: 1234 }, ...] em ordem cronológica.
 */
export function forecastNext(series, { allowNegative = false } = {}) {
  if (series.length < 3) return null;
  const model = linearRegression(series.map((item, index) => ({ x: index, y: item.value })));
  // Receita e atendimentos não ficam negativos; lucro pode (prejuízo)
  const raw = model.predict(series.length);
  const predicted = allowNegative ? raw : Math.max(0, raw);
  const last = series[series.length - 1].value;
  return {
    predicted,
    r2: model.r2,
    confidence: confidenceLabel(model.r2, series.length),
    trendPerMonth: model.slope,
    changeVsLast: last > 0 ? (predicted - last) / last : null,
  };
}

/**
 * Quando cada item do estoque deve acabar, pelo ritmo de consumo dos últimos dias.
 * usage: [{ day: 0..N, quantity }] consumo diário; balance: saldo atual.
 */
export function stockoutForecast(usage, balance, windowDays) {
  if (!(windowDays > 0)) return null;
  // Consumo acumulado ao longo dos dias: a inclinação da reta é o consumo médio por dia
  const byDay = new Map();
  usage.forEach((u) => byDay.set(u.day, (byDay.get(u.day) ?? 0) + u.quantity));
  let accumulated = 0;
  const points = [];
  for (let day = 0; day < windowDays; day++) {
    accumulated += byDay.get(day) ?? 0;
    points.push({ x: day, y: accumulated });
  }
  if (accumulated <= 0) return null;
  const model = linearRegression(points);
  // Inclinação da reta; se ela não fizer sentido (poucos dados), usa a média simples do período
  const perDay = model && model.slope > 0 ? model.slope : accumulated / windowDays;
  if (!(perDay > 0)) return null;
  return { perDay, daysLeft: balance / perDay, r2: model?.r2 ?? 0 };
}

/**
 * Atendimentos com custo real muito diferente do previsto na ficha.
 * items: [{ id, expected, real }]. Usa o escore-z da diferença percentual.
 */
export function findAnomalies(items, { minDeviation = 0.15, zLimit = 2 } = {}) {
  const valid = items.filter((item) => item.expected > 0);
  if (valid.length === 0) return [];
  const deviations = valid.map((item) => (item.real - item.expected) / item.expected);
  const mean = deviations.reduce((sum, d) => sum + d, 0) / deviations.length;
  const std = Math.sqrt(deviations.reduce((sum, d) => sum + (d - mean) ** 2, 0) / deviations.length);
  return valid
    .map((item, index) => {
      const deviation = deviations[index];
      const z = std > 0 ? (deviation - mean) / std : 0;
      return { ...item, deviation, z };
    })
    .filter((item) => Math.abs(item.deviation) >= minDeviation && (valid.length < 5 || Math.abs(item.z) >= zLimit))
    .sort((a, b) => Math.abs(b.deviation) - Math.abs(a.deviation));
}
