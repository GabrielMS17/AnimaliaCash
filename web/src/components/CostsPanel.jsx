import { useState } from 'react';
import { BCB_KEY_BY_FORMA } from '../services/bcbTaxas';
import {
  createFixedCost,
  deleteExtra,
  deleteFee,
  deleteFixedCost,
  EXTRA_CATEGORIES,
  extrasFor,
  FEE_FORMS,
  FIXED_CATEGORIES,
  fixedCostsFor,
  HOURS_PER_MONTH,
  laterChanges,
  saveExtra,
  saveFee,
  saveFixedCost,
} from '../services/costService';
import { monthLabel } from '../services/monthlyResult';
import { calculateProcedure, formatBRL, formatDecimal } from '../utils/costCalculations';
import { Field, Modal, NumberInput, Segmented } from './ui';

const PROCEDURE_CATEGORIES = [
  { value: 'cirurgia', label: 'Cirurgias' },
  { value: 'internacao', label: 'Internação' },
  { value: 'banho_tosa', label: 'Banho & Tosa' },
];
const shortMonth = (key) => monthLabel(key).replace(' de ', '/');

/** Avaliação simples por faixas do total de custos fixos e da taxa média. */
function diagnose(totalFixed, averageFee) {
  if (totalFixed === 0) return { status: 'Aguardando dados', color: '#64748b', message: 'Cadastre custos fixos para iniciar a análise.' };
  if (totalFixed > 20000 || averageFee > 4) return { status: 'Risco / Alerta vermelho', color: '#dc2626', message: 'Custos fixos elevados ou taxas acima da média ideal.' };
  if (totalFixed > 10000 || averageFee > 2.8) return { status: 'Estável com atenção', color: '#b45309', message: 'Operação equilibrada. Incentive pagamentos via Pix.' };
  return { status: 'Saudável e otimizada', color: '#047857', message: 'Sua estrutura de custos e taxas está bem alinhada.' };
}

/** Abas de custos do Resultado do mês: fixos, variáveis e taxas. `onChanged` recarrega o resultado. */
export default function CostsPanel({ tab, month, base, current, procedures, insumosMap, settings, bcb, onChanged }) {
  const [form, setForm] = useState(null); // { kind, item, nome, categoria, value, scope }
  const [removing, setRemoving] = useState(null); // { kind, item }
  const [details, setDetails] = useState(null); // categoria de procedimento
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const fixed = fixedCostsFor(month, base.fixedCosts, base.monthly);
  const extras = extrasFor(month, base.monthly);
  const bcbRateFor = (forma) => (bcb.state === 'ok' ? bcb.rates[BCB_KEY_BY_FORMA[forma]] ?? null : null);
  const averageFee = base.fees.length > 0 ? base.fees.reduce((sum, fee) => sum + Number(fee.taxa || 0), 0) / base.fees.length : 0;
  const diagnosis = diagnose(current.fixed, averageFee);

  const openForm = (kind, item = null) => {
    setError('');
    setForm({
      kind,
      item,
      nome: item ? item.nome ?? item.bandeira : '',
      categoria: item ? item.categoria ?? item.forma ?? '' : { fixo: FIXED_CATEGORIES[0], extra: EXTRA_CATEGORIES[3], taxa: FEE_FORMS[0] }[kind],
      value: item ? Number(item.value ?? item.valor ?? item.taxa ?? 0) : 0,
      scope: 'forward',
    });
  };

  const run = async (action, message) => {
    setSaving(true);
    setError('');
    try {
      await action();
      setForm(null);
      setRemoving(null);
      onChanged(message);
    } catch (runError) {
      setError(runError.message);
    }
    setSaving(false);
  };

  const submit = () => {
    const nome = form.nome.trim();
    if (!nome) return setError(form.kind === 'taxa' ? 'Informe o meio ou a bandeira.' : 'Informe o nome do custo.');
    if (form.kind === 'taxa' ? form.value < 0 || form.value > 100 : !(form.value >= 0)) return setError('Confira o valor informado.');
    if (form.kind !== 'taxa' && !form.item && !(form.value > 0)) return setError('Informe um valor maior que zero.');
    const { item, categoria, value, scope } = form;
    if (form.kind === 'taxa') return run(() => saveFee({ id: item?.id, bandeira: nome, forma: categoria, taxa: value }), `Taxa ${nome} salva.`);
    if (form.kind === 'extra') return run(() => saveExtra({ id: item?.id, nome, categoria, value, month }), `${nome}: ${formatBRL(value)} em ${monthLabel(month)}.`);
    const message = `${nome}: ${formatBRL(value)} ${scope === 'only' ? 'só em' : 'a partir de'} ${monthLabel(month)}.`;
    return run(() => (item
      ? saveFixedCost({ cost: item, nome, categoria, value, month, scope, monthly: base.monthly })
      : createFixedCost({ nome, categoria, value, month, scope })), message);
  };

  const options = form && (form.kind === 'taxa' ? FEE_FORMS : form.kind === 'extra' ? EXTRA_CATEGORIES : FIXED_CATEGORIES);
  const later = form?.kind === 'fixo' && form.item ? laterChanges(form.item, month, form.value, base.monthly) : 0;
  const forwardHint = later > 0 ? 'Os meses anteriores não mudam. Os seguintes que já têm outro valor também passam a usar este.' : 'Os meses anteriores não mudam.';
  const bcbRate = form?.kind === 'taxa' ? bcbRateFor(form.categoria) : null;
  const byCategory = PROCEDURE_CATEGORIES.map((category) => {
    const items = procedures
      .filter((procedure) => procedure.category === category.value)
      .map((procedure) => ({ ...procedure, cost: calculateProcedure(procedure, insumosMap, settings).breakdown.totalCost }))
      .sort((a, b) => b.cost - a.cost);
    return { ...category, items, total: items.reduce((sum, item) => sum + item.cost, 0) };
  });
  const detail = byCategory.find((category) => category.value === details);

  const rowActions = (kind, item) => (
    <div className="list-actions table-actions">
      <button type="button" className="btn btn-secondary btn-small" onClick={() => openForm(kind, item)}>{kind === 'fixo' ? 'Alterar' : 'Editar'}</button>
      <button type="button" className="btn btn-danger btn-small" onClick={() => { setError(''); setRemoving({ kind, item }); }}>Excluir</button>
    </div>
  );

  return (
    <>
      {base.monthly === null && tab !== 'taxas' && (
        <div className="notice-box">Os valores por mês ainda não existem no banco (falta rodar <code>supabase/custos_mensais.sql</code>).</div>
      )}

      {tab === 'fixos' && (
        <>
          <div className="metric-row costs-metrics">
            <div className="card metric">
              <div><strong>Custos fixos</strong><small>{monthLabel(month)}</small></div>
              <b className="navy-text">{formatBRL(current.fixed)}</b>
            </div>
            <div className="card metric">
              <div><strong>Hora/Sala</strong><small>Custos fixos ÷ {HOURS_PER_MONTH}h</small></div>
              <b>{formatBRL(current.fixed / HOURS_PER_MONTH)}/h</b>
            </div>
          </div>
          <div className="card table-card">
            <div className="costs-head">
              <h2>Custos fixos de {monthLabel(month)}</h2>
              <button type="button" className="btn btn-primary btn-small" onClick={() => openForm('fixo')}>+ Adicionar custo fixo</button>
            </div>
            <p className="muted-text">Contas que se repetem, como aluguel e energia. Alterar um valor não muda os meses anteriores.</p>
            <div className="table-scroll">
              <table className="stack-mobile">
                <thead><tr><th>Nome</th><th>Categoria</th><th className="right">Valor no mês</th><th className="center">Ações</th></tr></thead>
                <tbody>
                  {fixed.length === 0 && <tr><td colSpan={4} className="empty-text">Nenhum custo fixo cadastrado.</td></tr>}
                  {fixed.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Nome"><strong>{item.nome}</strong></td>
                      <td data-label="Categoria">{item.categoria}</td>
                      <td data-label="Valor no mês" className="right">
                        {item.value > 0 ? <strong>{formatBRL(item.value)}</strong> : <span className="muted">não vale neste mês</span>}
                      </td>
                      <td data-label="" className="center actions-cell">{rowActions('fixo', item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <p className="ai-badge">Diagnóstico da clínica</p>
            <div className="ai-result">
              <small>Taxa média cadastrada: {averageFee.toFixed(2)}%</small>
              <strong style={{ color: diagnosis.color }}>{diagnosis.status}</strong>
              <p>{diagnosis.message}</p>
            </div>
          </div>
        </>
      )}

      {tab === 'variaveis' && (
        <>
          <div className="card table-card">
            <h2>Custos variáveis de {monthLabel(month)}</h2>
            <p className="muted-text">Calculados pelos atendimentos e pelo estoque do mês, mais os extras que você lançar.</p>
            <table className="dre">
              <tbody>
                <CostRow label="Insumos consumidos" value={current.supplies} />
                <CostRow label="Profissionais terceirizados" value={current.external} />
                <CostRow label="Comissões" value={current.commission} />
                <CostRow label="Taxas de pagamento" value={current.fees} />
                <CostRow label="Extras lançados" value={current.extras} />
                <CostRow label="Total" value={current.supplies + current.external + current.commission + current.fees + current.extras} strong />
              </tbody>
            </table>
          </div>
          <div className="card table-card">
            <div className="costs-head">
              <h2>Extras de {monthLabel(month)}</h2>
              <button type="button" className="btn btn-primary btn-small" onClick={() => openForm('extra')}>+ Adicionar custo variável</button>
            </div>
            <p className="muted-text">Gastos só deste mês que não estão nas fichas, como um exame externo. Já saem do lucro.</p>
            <div className="table-scroll">
              <table className="stack-mobile">
                <thead><tr><th>Nome</th><th>Categoria</th><th className="right">Valor</th><th className="center">Ações</th></tr></thead>
                <tbody>
                  {extras.length === 0 && <tr><td colSpan={4} className="empty-text">Nenhum custo variável extra neste mês.</td></tr>}
                  {extras.map((item) => (
                    <tr key={item.id}>
                      <td data-label="Nome"><strong>{item.nome}</strong></td>
                      <td data-label="Categoria">{item.categoria}</td>
                      <td data-label="Valor" className="right"><strong>{formatBRL(Number(item.valor))}</strong></td>
                      <td data-label="" className="center actions-cell">{rowActions('extra', item)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card table-card">
            <h2>Custo das fichas por categoria</h2>
            <p className="muted-text">Quanto custa fazer cada procedimento uma vez (insumos, terceirizados e operacional, sem comissão).</p>
            <div className="table-scroll">
              <table className="stack-mobile">
                <thead><tr><th>Categoria</th><th className="center">Fichas</th><th className="right">Custo médio</th><th className="center">Ações</th></tr></thead>
                <tbody>
                  {byCategory.map((category) => (
                    <tr key={category.value}>
                      <td data-label="Categoria"><strong>{category.label}</strong></td>
                      <td data-label="Fichas" className="center">{category.items.length}</td>
                      <td data-label="Custo médio" className="right">{formatBRL(category.items.length > 0 ? category.total / category.items.length : 0)}</td>
                      <td data-label="" className="center actions-cell">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => setDetails(category.value)}>Ver detalhes</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {tab === 'taxas' && (
        <div className="card table-card">
          <div className="costs-head">
            <h2>Taxas cadastradas</h2>
            <button type="button" className="btn btn-primary btn-small" onClick={() => openForm('taxa')}>+ Adicionar taxa</button>
          </div>
          <div className="table-scroll">
            <table className="stack-mobile">
              <thead><tr><th>Meio / Bandeira</th><th>Forma de pagamento</th><th className="right">Taxa</th><th className="right">Média nacional (BCB)</th><th className="center">Ações</th></tr></thead>
              <tbody>
                {base.fees.length === 0 && <tr><td colSpan={5} className="empty-text">Nenhuma taxa cadastrada.</td></tr>}
                {base.fees.map((item) => {
                  const rate = bcbRateFor(item.forma);
                  return (
                    <tr key={item.id}>
                      <td data-label="Meio / bandeira"><strong>{item.bandeira}</strong></td>
                      <td data-label="Forma">{item.forma}</td>
                      <td data-label="Taxa" className={`right ${rate != null && Number(item.taxa) > rate ? 'danger-text' : 'accent-text'}`}>{Number(item.taxa).toFixed(2)}%</td>
                      <td data-label="Média nacional" className="right">{rate != null ? `${rate.toFixed(2)}%` : '—'}</td>
                      <td data-label="" className="center actions-cell">{rowActions('taxa', item)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <Modal
          title={`${form.item ? (form.kind === 'fixo' ? 'Alterar' : 'Editar') : 'Adicionar'} ${{ fixo: 'custo fixo', extra: 'custo variável', taxa: 'taxa' }[form.kind]}`}
          subtitle={form.kind === 'extra' ? `Vale só em ${monthLabel(month)}.` : undefined}
          onClose={() => setForm(null)}
          onSubmit={submit}
          footer={(
            <div className="actions-end">
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Salvar'}</button>
            </div>
          )}
        >
          {error && <div className="error-banner" role="alert">{error}</div>}
          <div className="form-row">
            <Field label={form.kind === 'taxa' ? 'Meio / Bandeira' : 'Nome'}>
              <input
                type="text"
                maxLength={100}
                placeholder={{ fixo: 'Ex: Energia', extra: 'Ex: Exame externo', taxa: 'Ex: Pix, Visa' }[form.kind]}
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
              />
            </Field>
            <Field label={form.kind === 'taxa' ? 'Forma de pagamento' : 'Categoria'}>
              <select value={form.categoria} onChange={(event) => setForm({ ...form, categoria: event.target.value })}>
                {!options.includes(form.categoria) && <option value={form.categoria}>{form.categoria || 'Sem categoria'}</option>}
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </Field>
          </div>
          <Field label={form.kind === 'taxa' ? 'Taxa' : 'Valor'}>
            <NumberInput
              min={0}
              prefix={form.kind === 'taxa' ? undefined : 'R$'}
              suffix={form.kind === 'taxa' ? '%' : undefined}
              label="Valor"
              value={form.value}
              onChange={(value) => setForm((previous) => (previous ? { ...previous, value } : previous))}
            />
          </Field>
          {form.kind === 'fixo' && (
            <Field
              label="Vale para"
              hint={form.scope === 'only' ? 'O mês seguinte volta ao valor de antes.' : forwardHint}
            >
              <Segmented
                label="Vale para"
                options={[{ value: 'forward', label: `De ${shortMonth(month)} em diante` }, { value: 'only', label: `Só em ${shortMonth(month)}` }]}
                value={form.scope}
                onChange={(scope) => setForm({ ...form, scope })}
              />
            </Field>
          )}
          {form.kind === 'taxa' && bcbRate != null && (
            <div className="bcb-hint">
              <span>Média nacional: <strong>{formatDecimal(bcbRate, 2)}%</strong> ({bcb.label})</span>
              <button type="button" className="btn btn-secondary btn-small" onClick={() => setForm({ ...form, value: Number(bcbRate.toFixed(2)) })}>Usar média do Banco Central</button>
            </div>
          )}
        </Modal>
      )}

      {removing && (
        <Modal
          title={`Excluir ${removing.item.nome ?? removing.item.bandeira}?`}
          onClose={() => setRemoving(null)}
          footer={(
            <div className="actions-end">
              <button type="button" className="btn btn-secondary" onClick={() => setRemoving(null)}>Cancelar</button>
              {removing.kind === 'fixo' && removing.item.value > 0 && (
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={saving}
                  onClick={() => run(() => saveFixedCost({
                    cost: removing.item, nome: removing.item.nome, categoria: removing.item.categoria, value: 0, month, scope: 'forward', monthly: base.monthly,
                  }), `${removing.item.nome}: encerrado a partir de ${monthLabel(month)}.`)}
                >
                  Encerrar a partir de {shortMonth(month)}
                </button>
              )}
              <button
                type="button"
                className="btn btn-danger"
                disabled={saving}
                onClick={() => run(
                  () => ({ fixo: deleteFixedCost, extra: deleteExtra, taxa: deleteFee })[removing.kind](removing.item.id),
                  `${removing.item.nome ?? removing.item.bandeira}: excluído.`,
                )}
              >
                {removing.kind === 'fixo' ? 'Excluir de todos os meses' : 'Excluir'}
              </button>
            </div>
          )}
        >
          {error && <div className="error-banner" role="alert">{error}</div>}
          <p>
            {removing.kind === 'fixo'
              ? 'Encerrar mantém o histórico: os meses anteriores continuam com o valor. Excluir apaga o custo de todos os meses e muda os lucros passados, sem como desfazer.'
              : 'Não dá para desfazer.'}
          </p>
        </Modal>
      )}

      {detail && (
        <Modal
          title={`Fichas de ${detail.label}`}
          onClose={() => setDetails(null)}
          footer={<div className="actions-end"><button type="button" className="btn btn-secondary" onClick={() => setDetails(null)}>Fechar</button></div>}
        >
          <table className="dre">
            <tbody>
              {detail.items.length === 0 && <tr><td className="empty-text">Nenhuma ficha nesta categoria.</td></tr>}
              {detail.items.map((item) => <CostRow key={item.id} label={`${item.name}${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`} value={item.cost} />)}
            </tbody>
          </table>
        </Modal>
      )}
    </>
  );
}

function CostRow({ label, value, strong }) {
  return (
    <tr className={strong ? 'strong total' : ''}>
      <td>{label}</td>
      <td className="right">{formatBRL(value)}</td>
    </tr>
  );
}
