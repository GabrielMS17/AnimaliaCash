// Taxas médias de cartão (MDR) publicadas pelo Banco Central, em dados abertos.
// Fonte: Estatísticas de Meios de Pagamento, recurso DESCONTODA (OData), por trimestre.
// O BCB publica cerca de 90 dias depois do fim de cada trimestre, então buscamos o mais recente disponível.

const ENDPOINT = 'https://olinda.bcb.gov.br/olinda/servico/MPV_DadosAbertos/versao/v1/odata/DESCONTODA(trimestre=@trimestre)';

/** Formas de pagamento da clínica -> taxa média do BCB correspondente. */
export const BCB_KEY_BY_FORMA = {
  'Débito': 'debito',
  'Crédito à vista': 'creditoVista',
  'Crédito Parcelado (2x a 6x)': 'creditoParcelado',
};

/** Trimestres candidatos, do mais recente para trás, no formato do BCB ("20262" = 2º tri de 2026). */
export function candidateQuarters(today = new Date(), count = 6) {
  let year = today.getFullYear();
  let quarter = Math.floor(today.getMonth() / 3) + 1;
  const list = [];
  for (let i = 0; i < count; i++) {
    quarter -= 1;
    if (quarter === 0) {
      quarter = 4;
      year -= 1;
    }
    list.push(`${year}${quarter}`);
  }
  return list;
}

export function quarterLabel(code) {
  const text = String(code);
  return `${text.slice(-1)}º trimestre de ${text.slice(0, 4)}`;
}

/** Média das taxas ponderada pelo volume transacionado, por tipo de cartão. */
export function summarizeMdr(rows) {
  const groups = {};
  const add = (key, row) => {
    const volume = Number(row.valorDesconto) || 0;
    groups[key] = groups[key] ?? { volume: 0, weighted: 0 };
    groups[key].volume += volume;
    groups[key].weighted += volume * Number(row.txMediaDesconto);
  };
  rows.forEach((row) => {
    if (row.funcaoCartao === 'Débito') add('debito', row);
    else if (row.funcaoCartao === 'Pré-pago') add('prePago', row);
    else if (row.funcaoCartao === 'Crédito') {
      if (row.numeroparcelas === '1 parcela') add('creditoVista', row);
      // A clínica parcela de 2x a 6x: usa as faixas "2 e 3" e "4 a 6" parcelas
      else if (['2 e 3 parcelas', '4 a 6 parcelas'].includes(row.numeroparcelas)) add('creditoParcelado', row);
    }
  });
  const rates = {};
  Object.entries(groups).forEach(([key, group]) => {
    rates[key] = group.volume > 0 ? Math.round((group.weighted / group.volume) * 100) / 100 : null;
  });
  return rates;
}

/** Busca o trimestre mais recente publicado. Retorna { trimestre, label, rates }. */
export async function fetchBcbMdr({ signal } = {}) {
  for (const quarter of candidateQuarters()) {
    const url = `${ENDPOINT}?@trimestre='${quarter}'&$format=json`;
    const response = await fetch(url, { signal });
    if (!response.ok) continue;
    const data = await response.json();
    if (Array.isArray(data.value) && data.value.length > 0) {
      return { trimestre: quarter, label: quarterLabel(quarter), rates: summarizeMdr(data.value) };
    }
  }
  throw new Error('O Banco Central não retornou dados de taxas dos últimos trimestres.');
}
