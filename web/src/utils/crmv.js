// Regras do registro profissional (CRMV) dos veterinários.
// O registro é sempre de um conselho regional, por isso é guardado com a UF: "SP-12345".
// Na tela aparece no padrão orientado pelo CFMV: "CRMV-SP nº 12345".

export const UFS = [
  'AC', 'AL', 'AM', 'AP', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MG', 'MS', 'MT', 'PA',
  'PB', 'PE', 'PI', 'PR', 'RJ', 'RN', 'RO', 'RR', 'RS', 'SC', 'SE', 'SP', 'TO',
];

export const CRMV_MAX_DIGITS = 6;

/** Mantém só os dígitos do número digitado (e no máximo 6). */
export function onlyCrmvDigits(text) {
  return String(text ?? '').replace(/\D/g, '').slice(0, CRMV_MAX_DIGITS);
}

/** Retorna a mensagem de erro, ou null se o CRMV estiver válido. */
export function validateCrmv(uf, number) {
  if (!uf) return 'Selecione a UF do conselho regional (CRMV) do veterinário.';
  if (!UFS.includes(uf)) return 'UF do CRMV inválida.';
  const digits = String(number ?? '').trim();
  if (!digits) return 'O número do CRMV é obrigatório para cadastros com o perfil de Veterinário.';
  if (!/^\d+$/.test(digits)) return 'O número do CRMV deve conter apenas números.';
  if (digits.length > CRMV_MAX_DIGITS) return `O número do CRMV deve ter no máximo ${CRMV_MAX_DIGITS} dígitos.`;
  if (/^0+$/.test(digits)) return 'Informe um número de CRMV válido.';
  return null;
}

/** Valor guardado no banco: "SP-12345" (sem zeros à esquerda). */
export function buildCrmv(uf, number) {
  return `${uf}-${String(Number(number))}`;
}

/** Texto para exibir. Cadastros antigos, sem UF, aparecem como foram digitados. */
export function formatCrmv(value) {
  if (!value) return 'Não informado';
  const match = String(value).match(/^([A-Z]{2})-(\d+)$/);
  return match ? `CRMV-${match[1]} nº ${match[2]}` : String(value);
}
