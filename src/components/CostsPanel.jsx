import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
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
import { AppModal, Button, COLORS, ErrorBanner, Field, Input, NumberInput, Segmented, Select } from './ui';

const PROCEDURE_CATEGORIES = [
  { value: 'cirurgia', label: 'Cirurgias' },
  { value: 'internacao', label: 'Internação' },
  { value: 'banho_tosa', label: 'Banho & Tosa' },
];
const toOptions = (list) => list.map((item) => ({ value: item, label: item }));
const shortMonth = (key) => monthLabel(key).replace(' de ', '/');

/** Avaliação simples por faixas do total de custos fixos e da taxa média. */
function diagnose(totalFixed, averageFee) {
  if (totalFixed === 0) return { status: 'Aguardando dados', color: COLORS.muted, message: 'Cadastre custos fixos para iniciar a análise.' };
  if (totalFixed > 20000 || averageFee > 4) return { status: 'Risco / Alerta vermelho', color: COLORS.danger, message: 'Custos fixos elevados ou taxas acima da média ideal.' };
  if (totalFixed > 10000 || averageFee > 2.8) return { status: 'Estável com atenção', color: COLORS.warning, message: 'Operação equilibrada. Incentive pagamentos via Pix.' };
  return { status: 'Saudável e otimizada', color: '#047857', message: 'Sua estrutura de custos e taxas está bem alinhada.' };
}

/** Abas de custos do Resultado do mês: fixos, variáveis e taxas. `onChanged` recarrega o resultado. */
export default function CostsPanel({ tab, month, base, current, procedures, insumosMap, settings, bcb, onChanged }) {
  const [form, setForm] = useState(null); // { kind, item, nome, categoria, value, scope }
  const [removing, setRemoving] = useState(null); // { kind, item }
  const [details, setDetails] = useState(null); // categoria de procedimento
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const fixed = fixedCostsFor(month, base.fixedCosts, base.monthly);
  const extras = extrasFor(month, base.monthly);
  const bcbRateFor = (forma) => (bcb.state === 'ok' ? bcb.rates[BCB_KEY_BY_FORMA[forma]] ?? null : null);
  const averageFee = base.fees.length > 0 ? base.fees.reduce((sum, fee) => sum + Number(fee.taxa || 0), 0) / base.fees.length : 0;
  const diagnosis = diagnose(current.fixed, averageFee);

  const openForm = (kind, item = null) => {
    setErrorMsg('');
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
    setErrorMsg('');
    try {
      await action();
      setForm(null);
      setRemoving(null);
      onChanged(message);
    } catch (error) {
      setErrorMsg(error.message);
    }
    setSaving(false);
  };

  const submit = () => {
    const nome = form.nome.trim();
    if (!nome) return setErrorMsg(form.kind === 'taxa' ? 'Informe o meio ou a bandeira.' : 'Informe o nome do custo.');
    if (form.kind === 'taxa' ? form.value < 0 || form.value > 100 : !(form.value >= 0)) return setErrorMsg('Confira o valor informado.');
    if (form.kind !== 'taxa' && !form.item && !(form.value > 0)) return setErrorMsg('Informe um valor maior que zero.');
    const { item, categoria, value, scope } = form;
    if (form.kind === 'taxa') return run(() => saveFee({ id: item?.id, bandeira: nome, forma: categoria, taxa: value }), `Taxa ${nome} salva.`);
    if (form.kind === 'extra') return run(() => saveExtra({ id: item?.id, nome, categoria, value, month }), `${nome}: ${formatBRL(value)} em ${monthLabel(month)}.`);
    const message = `${nome}: ${formatBRL(value)} ${scope === 'only' ? 'só em' : 'a partir de'} ${monthLabel(month)}.`;
    return run(() => (item
      ? saveFixedCost({ cost: item, nome, categoria, value, month, scope, monthly: base.monthly })
      : createFixedCost({ nome, categoria, value, month, scope })), message);
  };

  const options = form ? (form.kind === 'taxa' ? FEE_FORMS : form.kind === 'extra' ? EXTRA_CATEGORIES : FIXED_CATEGORIES) : [];
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
    <View style={styles.actions}>
      <Button small variant="secondary" label={kind === 'fixo' ? 'Alterar' : 'Editar'} onPress={() => openForm(kind, item)} />
      <Button small variant="danger" label="Excluir" onPress={() => { setErrorMsg(''); setRemoving({ kind, item }); }} />
    </View>
  );

  return (
    <View style={styles.stack}>
      {base.monthly === null && tab !== 'taxas' && (
        <View style={styles.notice}>
          <Text style={styles.noticeText}>Os valores por mês ainda não existem no banco (falta rodar supabase/custos_mensais.sql).</Text>
        </View>
      )}

      {tab === 'fixos' && (
        <>
          <View style={styles.metrics}>
            <Metric label="Custos fixos" hint={monthLabel(month)} value={formatBRL(current.fixed)} />
            <Metric label="Hora/Sala" hint={`Custos fixos ÷ ${HOURS_PER_MONTH}h`} value={`${formatBRL(current.fixed / HOURS_PER_MONTH)}/h`} />
          </View>
          <Card
            title={`Custos fixos de ${monthLabel(month)}`}
            hint="Contas que se repetem, como aluguel e energia. Alterar um valor não muda os meses anteriores."
            action={<Button small label="+ Adicionar custo fixo" onPress={() => openForm('fixo')} />}
          >
            {fixed.length === 0 && <Text style={styles.empty}>Nenhum custo fixo cadastrado.</Text>}
            {fixed.map((item) => (
              <Row
                key={item.id}
                title={item.nome}
                detail={item.categoria}
                value={item.value > 0 ? formatBRL(item.value) : 'não vale neste mês'}
                muted={!(item.value > 0)}
                actions={rowActions('fixo', item)}
              />
            ))}
          </Card>
          <Card title="Diagnóstico da clínica">
            <Text style={styles.small}>Taxa média cadastrada: {averageFee.toFixed(2)}%</Text>
            <Text style={[styles.diagnosis, { color: diagnosis.color }]}>{diagnosis.status}</Text>
            <Text style={styles.small}>{diagnosis.message}</Text>
          </Card>
        </>
      )}

      {tab === 'variaveis' && (
        <>
          <Card title={`Custos variáveis de ${monthLabel(month)}`} hint="Calculados pelos atendimentos e pelo estoque do mês, mais os extras que você lançar.">
            <CostRow label="Insumos consumidos" value={current.supplies} />
            <CostRow label="Profissionais terceirizados" value={current.external} />
            <CostRow label="Comissões" value={current.commission} />
            <CostRow label="Taxas de pagamento" value={current.fees} />
            <CostRow label="Extras lançados" value={current.extras} />
            <CostRow label="Total" value={current.supplies + current.external + current.commission + current.fees + current.extras} strong />
          </Card>
          <Card
            title={`Extras de ${monthLabel(month)}`}
            hint="Gastos só deste mês que não estão nas fichas, como um exame externo. Já saem do lucro."
            action={<Button small label="+ Adicionar custo variável" onPress={() => openForm('extra')} />}
          >
            {extras.length === 0 && <Text style={styles.empty}>Nenhum custo variável extra neste mês.</Text>}
            {extras.map((item) => (
              <Row key={item.id} title={item.nome} detail={item.categoria} value={formatBRL(Number(item.valor))} actions={rowActions('extra', item)} />
            ))}
          </Card>
          <Card title="Custo das fichas por categoria" hint="Quanto custa fazer cada procedimento uma vez (insumos, terceirizados e operacional, sem comissão).">
            {byCategory.map((category) => (
              <Row
                key={category.value}
                title={category.label}
                detail={`${category.items.length} fichas · custo médio`}
                value={formatBRL(category.items.length > 0 ? category.total / category.items.length : 0)}
                actions={<Button small variant="secondary" label="Ver detalhes" onPress={() => setDetails(category.value)} />}
              />
            ))}
          </Card>
        </>
      )}

      {tab === 'taxas' && (
        <Card title="Taxas cadastradas" action={<Button small label="+ Adicionar taxa" onPress={() => openForm('taxa')} />}>
          {base.fees.length === 0 && <Text style={styles.empty}>Nenhuma taxa cadastrada.</Text>}
          {base.fees.map((item) => {
            const rate = bcbRateFor(item.forma);
            return (
              <Row
                key={item.id}
                title={item.bandeira}
                detail={`${item.forma} · média nacional ${rate != null ? `${rate.toFixed(2)}%` : '—'}`}
                value={`${Number(item.taxa).toFixed(2)}%`}
                danger={rate != null && Number(item.taxa) > rate}
                actions={rowActions('taxa', item)}
              />
            );
          })}
        </Card>
      )}

      {form && (
        <AppModal
          title={`${form.item ? (form.kind === 'fixo' ? 'Alterar' : 'Editar') : 'Adicionar'} ${{ fixo: 'custo fixo', extra: 'custo variável', taxa: 'taxa' }[form.kind]}`}
          subtitle={form.kind === 'extra' ? `Vale só em ${monthLabel(month)}.` : undefined}
          maxWidth={520}
          onClose={() => setForm(null)}
          footer={(
            <View style={styles.footer}>
              <Button label="Cancelar" variant="secondary" onPress={() => setForm(null)} />
              <Button label={saving ? 'Salvando…' : 'Salvar'} onPress={submit} disabled={saving} />
            </View>
          )}
        >
          <ErrorBanner message={errorMsg} />
          <Field label={form.kind === 'taxa' ? 'Meio / Bandeira' : 'Nome'}>
            <Input
              maxLength={100}
              placeholder={{ fixo: 'Ex: Energia', extra: 'Ex: Exame externo', taxa: 'Ex: Pix, Visa' }[form.kind]}
              value={form.nome}
              onChangeText={(nome) => setForm({ ...form, nome })}
            />
          </Field>
          <Field label={form.kind === 'taxa' ? 'Forma de pagamento' : 'Categoria'}>
            <Select
              value={form.categoria}
              options={toOptions(options.includes(form.categoria) || !form.categoria ? options : [form.categoria, ...options])}
              onChange={(categoria) => setForm({ ...form, categoria })}
            />
          </Field>
          <Field label={form.kind === 'taxa' ? 'Taxa' : 'Valor'}>
            <NumberInput
              min={0}
              prefix={form.kind === 'taxa' ? undefined : 'R$'}
              suffix={form.kind === 'taxa' ? '%' : undefined}
              value={form.value}
              onChange={(value) => setForm((previous) => (previous ? { ...previous, value } : previous))}
            />
          </Field>
          {form.kind === 'fixo' && (
            <Field label="Vale para" hint={form.scope === 'only' ? 'O mês seguinte volta ao valor de antes.' : forwardHint}>
              <Segmented
                options={[{ value: 'forward', label: `De ${shortMonth(month)} em diante` }, { value: 'only', label: `Só em ${shortMonth(month)}` }]}
                value={form.scope}
                onChange={(scope) => setForm({ ...form, scope })}
              />
            </Field>
          )}
          {form.kind === 'taxa' && bcbRate != null && (
            <View style={styles.notice}>
              <Text style={styles.noticeText}>Média nacional: {formatDecimal(bcbRate, 2)}% ({bcb.label})</Text>
              <Button small variant="secondary" label="Usar média do Banco Central" onPress={() => setForm({ ...form, value: Number(bcbRate.toFixed(2)) })} style={{ alignSelf: 'flex-start' }} />
            </View>
          )}
        </AppModal>
      )}

      {removing && (
        <AppModal
          title={`Excluir ${removing.item.nome ?? removing.item.bandeira}?`}
          maxWidth={520}
          onClose={() => setRemoving(null)}
          footer={(
            <View style={styles.footer}>
              <Button label="Cancelar" variant="secondary" onPress={() => setRemoving(null)} />
              {removing.kind === 'fixo' && removing.item.value > 0 && (
                <Button
                  label={`Encerrar a partir de ${shortMonth(month)}`}
                  disabled={saving}
                  onPress={() => run(() => saveFixedCost({
                    cost: removing.item, nome: removing.item.nome, categoria: removing.item.categoria, value: 0, month, scope: 'forward', monthly: base.monthly,
                  }), `${removing.item.nome}: encerrado a partir de ${monthLabel(month)}.`)}
                />
              )}
              <Button
                variant="danger"
                label={removing.kind === 'fixo' ? 'Excluir de todos os meses' : 'Excluir'}
                disabled={saving}
                onPress={() => run(
                  () => ({ fixo: deleteFixedCost, extra: deleteExtra, taxa: deleteFee })[removing.kind](removing.item.id),
                  `${removing.item.nome ?? removing.item.bandeira}: excluído.`,
                )}
              />
            </View>
          )}
        >
          <ErrorBanner message={errorMsg} />
          <Text style={styles.text}>
            {removing.kind === 'fixo'
              ? 'Encerrar mantém o histórico: os meses anteriores continuam com o valor. Excluir apaga o custo de todos os meses e muda os lucros passados, sem como desfazer.'
              : 'Não dá para desfazer.'}
          </Text>
        </AppModal>
      )}

      {detail && (
        <AppModal
          title={`Fichas de ${detail.label}`}
          maxWidth={560}
          onClose={() => setDetails(null)}
          footer={<View style={styles.footer}><Button label="Fechar" variant="secondary" onPress={() => setDetails(null)} /></View>}
        >
          {detail.items.length === 0 && <Text style={styles.empty}>Nenhuma ficha nesta categoria.</Text>}
          {detail.items.map((item) => <CostRow key={item.id} label={`${item.name}${item.targetWeightKg ? ` · ${item.targetWeightKg} kg` : ''}`} value={item.cost} />)}
        </AppModal>
      )}
    </View>
  );
}

function Card({ title, hint, action, children }) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHead}>
        <Text style={styles.cardTitle}>{title}</Text>
        {action}
      </View>
      {hint ? <Text style={styles.small}>{hint}</Text> : null}
      {children}
    </View>
  );
}

function Metric({ label, hint, value }) {
  return (
    <View style={[styles.card, styles.metric]}>
      <Text style={styles.small}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.small}>{hint}</Text>
    </View>
  );
}

function Row({ title, detail, value, muted, danger, actions }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowInfo}>
        <Text style={styles.rowTitle}>{title}</Text>
        {detail ? <Text style={styles.small}>{detail}</Text> : null}
      </View>
      <Text style={[styles.rowValue, muted && styles.mutedValue, danger && { color: COLORS.danger }]}>{value}</Text>
      {actions}
    </View>
  );
}

function CostRow({ label, value, strong }) {
  return (
    <View style={[styles.costRow, strong && styles.costTotal]}>
      <Text style={[styles.text, { flex: 1 }, strong && styles.rowTitle]}>{label}</Text>
      <Text style={[styles.text, strong && styles.rowTitle]}>{formatBRL(value)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 14 },
  notice: { padding: 12, gap: 8, borderRadius: 10, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD' },
  noticeText: { fontSize: 13, color: '#0C4A6E' },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metric: { flexGrow: 1, flexBasis: 180, gap: 2 },
  metricValue: { fontSize: 20, fontWeight: '800', color: COLORS.text },
  card: { padding: 16, gap: 8, backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  cardHead: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: COLORS.navy, flexShrink: 1 },
  small: { fontSize: 12, color: COLORS.muted },
  text: { fontSize: 13, color: COLORS.textSoft },
  diagnosis: { fontSize: 15, fontWeight: '700' },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 10, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  rowInfo: { flexGrow: 1, flexBasis: 150, minWidth: 0 },
  rowTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  rowValue: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  mutedValue: { fontSize: 12, fontWeight: '400', color: COLORS.muted },
  actions: { flexDirection: 'row', gap: 6 },
  costRow: { flexDirection: 'row', gap: 10, paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  costTotal: { borderBottomWidth: 0, borderTopWidth: 2, borderTopColor: COLORS.navy },
  footer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 8 },
  empty: { padding: 16, textAlign: 'center', color: COLORS.muted },
});
