import { useCallback, useEffect, useState } from 'react';
import { Field, Modal, NumberInput, Segmented } from '../components/ui';
import { useData } from '../store/DataContext';
import { supabase } from '../supabase';
import { calculateProcedure, formatBRL } from '../utils/costCalculations';

// Mesma tela do app: custos fixos e taxas ficam nas tabelas custos_fixos e taxas_pagamento do Supabase
const TABS = [
  { value: 'custos', label: 'Custos Fixos' },
  { value: 'variaveis', label: 'Custos Variáveis' },
  { value: 'taxas', label: 'Taxas de Pagamento' },
];
const CATEGORIAS_CUSTOS = ['Estrutura', 'Utilidades', 'Pessoal', 'Administrativo', 'Manutenção'];
const CATEGORIAS_VARIAVEIS = [
  { value: 'cirurgia', label: 'Cirurgias' },
  { value: 'internacao', label: 'Internação' },
  { value: 'banho_tosa', label: 'Banho e Tosa' },
];
const FORMAS_TAXAS = ['À vista / Instantâneo', 'Débito', 'Crédito à vista', 'Crédito Parcelado (2x a 6x)'];
const DEFAULT_CATEGORY = { custos: 'Estrutura', variaveis: 'cirurgia', taxas: 'À vista / Instantâneo' };

const toOptions = (list) => list.map((item) => ({ value: item, label: item }));
const variableLabel = (category) => CATEGORIAS_VARIAVEIS.find((item) => item.value === category)?.label ?? category;

function diagnose(totalFixed, averageFee, hasProcedures) {
  if (totalFixed === 0 && !hasProcedures) {
    return { status: 'Aguardando Dados', color: '#94A3B8', message: 'Cadastre custos fixos para iniciar a análise.' };
  }
  if (totalFixed > 20000 || averageFee > 4.0) {
    return { status: 'Risco / Alerta Vermelho', color: '#EF4444', message: 'Custos fixos elevados ou taxas acima da média ideal.' };
  }
  if (totalFixed > 10000 || averageFee > 2.8) {
    return { status: 'Estável com Atenção', color: '#F59E0B', message: 'Operação equilibrada. Incentive pagamentos via Pix.' };
  }
  return { status: 'Saudável e Otimizada', color: '#00A86B', message: 'Sua estrutura de custos e taxas está perfeitamente alinhada.' };
}

export default function Custos() {
  const { procedures, insumosMap, settings, saveProcedure } = useData();
  const [tab, setTab] = useState('custos');
  const [custosFixos, setCustosFixos] = useState([]);
  const [taxas, setTaxas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [form, setForm] = useState(null); // { id, nome, categoria, valor }
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [details, setDetails] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const [custosResult, taxasResult] = await Promise.all([
      supabase.from('custos_fixos').select('*').order('nome', { ascending: true }),
      supabase.from('taxas_pagamento').select('*').order('bandeira', { ascending: true }),
    ]);
    const error = custosResult.error || taxasResult.error;
    if (error) {
      console.error('Erro ao carregar custos fixos e taxas:', error);
      setLoadError(`Não foi possível carregar os dados: ${error.message}`);
    } else {
      setCustosFixos(custosResult.data ?? []);
      setTaxas(taxasResult.data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const calculated = procedures.map((procedure) => ({
    ...procedure,
    totalCost: calculateProcedure(procedure, insumosMap, settings).breakdown.totalCost || 0,
  }));
  const consolidated = CATEGORIAS_VARIAVEIS.map((category) => {
    const items = calculated.filter((procedure) => procedure.category === category.value);
    return { ...category, count: items.length, total: items.reduce((sum, item) => sum + item.totalCost, 0) };
  });

  const totalFixed = custosFixos.reduce((sum, item) => sum + Number(item.valor || 0), 0);
  const totalVariable = consolidated.reduce((sum, item) => sum + item.total, 0);
  const hourlyRoom = totalFixed > 0 ? totalFixed / 160 : 0;
  const averageFee = taxas.length > 0 ? taxas.reduce((sum, item) => sum + Number(item.taxa || 0), 0) / taxas.length : 2.5;
  const diagnosis = diagnose(totalFixed, averageFee, procedures.length > 0);

  const openCreate = () => {
    setFormError('');
    setNotice('');
    setForm({ id: null, nome: '', categoria: DEFAULT_CATEGORY[tab], valor: 0 });
  };

  const openEdit = (item) => {
    setFormError('');
    setNotice('');
    setForm(tab === 'custos'
      ? { id: item.id, nome: item.nome, categoria: item.categoria || 'Estrutura', valor: Number(item.valor) }
      : { id: item.id, nome: item.bandeira, categoria: item.forma || 'À vista / Instantâneo', valor: Number(item.taxa) });
  };

  const save = async () => {
    if (!form.valor) {
      setFormError('Por favor, preencha o valor/taxa.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    try {
      if (tab === 'variaveis') {
        // Vira um procedimento só com custo fixo, sincronizado como os demais
        saveProcedure({
          id: `proc_${Date.now()}`,
          name: form.nome.trim() || `Custo Extra (${variableLabel(form.categoria)})`,
          category: form.categoria,
          description: 'Cadastrado como custo variável extra',
          fixedOverheadCost: form.valor,
          durationMinutes: 60,
          items: [],
        });
        setNotice('Custo variável extra adicionado com sucesso!');
      } else {
        const table = tab === 'custos' ? 'custos_fixos' : 'taxas_pagamento';
        const row = tab === 'custos'
          ? { nome: form.nome, categoria: form.categoria || 'Geral', valor: form.valor }
          : { bandeira: form.nome, forma: form.categoria || 'Geral', taxa: form.valor };
        const { error } = form.id
          ? await supabase.from(table).update(row).eq('id', form.id)
          : await supabase.from(table).insert([row]);
        if (error) throw error;
        fetchData();
      }
      setForm(null);
    } catch (error) {
      console.error('Erro ao salvar:', error);
      setFormError(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    setDeleting(true);
    const table = tab === 'custos' ? 'custos_fixos' : 'taxas_pagamento';
    const { error } = await supabase.from(table).delete().eq('id', toDelete.id);
    setDeleting(false);
    if (error) {
      console.error('Erro ao excluir:', error);
      setNotice(`Erro ao excluir: ${error.message}`);
    } else {
      fetchData();
    }
    setToDelete(null);
  };

  const formTitle = form?.id
    ? 'Editar Registro'
    : { custos: 'Adicionar Novo Custo Fixo', variaveis: 'Adicionar Custo Variável Extra', taxas: 'Adicionar Nova Taxa' }[tab];
  const detailItems = details ? calculated.filter((procedure) => procedure.category === details) : [];

  return (
    <>
      <div className="page-title">
        <h1>Custos e Taxas da Clínica</h1>
        <p>Gerencie custos operacionais fixos, consolidação de variáveis, cálculo de hora/sala e taxas de pagamento.</p>
      </div>

      <div className="metric-row">
        <div className="card metric">
          <div>
            <strong>Hora/Sala Calculada</strong>
            <small>Baseado nos custos fixos</small>
          </div>
          <b>{formatBRL(hourlyRoom)} / h</b>
        </div>
        <div className="card metric">
          <div>
            <strong>Total Variável Consolidado</strong>
            <small>Cirurgia, Internação, Banho e Tosa</small>
          </div>
          <b className="navy-text">{formatBRL(totalVariable)}</b>
        </div>
      </div>

      <div className="card">
        <p className="ai-badge">🤖 DIAGNÓSTICO INTELIGENTE DA CLÍNICA (IA)</p>
        <p className="muted-text">
          O modelo analisa dinamicamente o volume dos seus custos fixos e as taxas médias cadastradas para auditar a saúde financeira.
        </p>
        <div className="ai-result">
          <small>Taxa Média Aplicada: {averageFee.toFixed(2)}%</small>
          <strong style={{ color: diagnosis.color }}>{diagnosis.status}</strong>
          <p>{diagnosis.message}</p>
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={openCreate}>
        {{ custos: '+ Novo Custo Fixo', variaveis: '+ Adicionar Custo Variável Extra', taxas: '+ Nova Taxa de Pagamento' }[tab]}
      </button>
      {notice && <p className={notice.startsWith('Erro') ? 'error-text' : 'saved-text'} role="status">{notice}</p>}

      <Segmented label="Tipo de cadastro" options={TABS} value={tab} onChange={(value) => { setTab(value); setNotice(''); }} />

      {loading ? (
        <p className="empty-text" role="status">Carregando dados financeiros…</p>
      ) : loadError ? (
        <p className="error-text" role="alert">{loadError}</p>
      ) : tab === 'custos' ? (
        <div className="card table-card">
          <h2>Custos Fixos Cadastrados</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Nome / Descrição</th><th>Categoria</th><th className="right">Valor Mensal</th><th className="center">Ações</th></tr>
              </thead>
              <tbody>
                {custosFixos.length === 0 && <tr><td colSpan={4} className="empty-text">Nenhum custo fixo cadastrado.</td></tr>}
                {custosFixos.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.nome}</strong></td>
                    <td>{item.categoria}</td>
                    <td className="right"><strong>{formatBRL(Number(item.valor))}</strong></td>
                    <td className="center">
                      <div className="list-actions table-actions">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => openEdit(item)}>Editar</button>
                        <button type="button" className="btn btn-danger btn-small" onClick={() => setToDelete(item)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : tab === 'variaveis' ? (
        <div className="card table-card">
          <h2>Custos Variáveis por Categoria (Consolidado)</h2>
          <p className="muted-text">Clique em uma categoria para ver os itens detalhados calculados.</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Categoria</th><th className="center">Qtd. Itens</th><th className="right">Valor Total</th></tr>
              </thead>
              <tbody>
                {consolidated.map((item) => (
                  <tr key={item.value} className="clickable-row" onClick={() => setDetails(item.value)}>
                    <td>
                      <button type="button" className="link-button" onClick={(event) => { event.stopPropagation(); setDetails(item.value); }}>
                        {item.label} 🔍
                      </button>
                    </td>
                    <td className="center">{item.count} cad.</td>
                    <td className="right"><strong>{formatBRL(item.total)}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card table-card">
          <h2>Taxas de Pagamento Cadastradas</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Meio / Bandeira</th><th>Forma de Pagamento</th><th className="right">Taxa</th><th className="center">Ações</th></tr>
              </thead>
              <tbody>
                {taxas.length === 0 && <tr><td colSpan={4} className="empty-text">Nenhuma taxa cadastrada.</td></tr>}
                {taxas.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.bandeira}</strong></td>
                    <td>{item.forma}</td>
                    <td className="right accent-text">{Number(item.taxa).toFixed(2)}%</td>
                    <td className="center">
                      <div className="list-actions table-actions">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => openEdit(item)}>Editar</button>
                        <button type="button" className="btn btn-danger btn-small" onClick={() => setToDelete(item)}>Excluir</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {details && (
        <Modal
          title={`Itens de ${variableLabel(details)}`}
          onClose={() => setDetails(null)}
          footer={<button type="button" className="btn btn-secondary" onClick={() => setDetails(null)}>Fechar</button>}
        >
          {detailItems.length === 0 ? (
            <p className="empty-text">Nenhum item cadastrado nesta categoria.</p>
          ) : (
            detailItems.map((item) => (
              <div key={item.id} className="detail-line">
                <div>
                  <strong>{item.name}</strong>
                  <small>{item.targetWeightKg ? `${item.targetWeightKg} kg • ` : ''}Duração: {item.durationMinutes || 60} min</small>
                </div>
                <strong>{formatBRL(item.totalCost)}</strong>
              </div>
            ))
          )}
        </Modal>
      )}

      {form && (
        <Modal
          title={formTitle}
          onClose={() => setForm(null)}
          onSubmit={save}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar'}</button>
            </>
          )}
        >
          <div className="form-group">
            <Field label={{ custos: 'Nome do Custo', variaveis: 'Nome do Custo Variável / Procedimento Extra', taxas: 'Meio / Bandeira' }[tab]}>
              <input
                type="text"
                autoFocus
                placeholder={{ custos: 'Ex: Aluguel, Energia...', variaveis: 'Ex: Exame de sangue extra, Material adicional...', taxas: 'Ex: PIX, Cartão Visa...' }[tab]}
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
              />
            </Field>
            <div className="field">
              <span className="field-label">{{ custos: 'Selecione a Categoria', variaveis: 'Categoria de Destino', taxas: 'Forma de Pagamento' }[tab]}</span>
              <Segmented
                label="Categoria"
                options={tab === 'custos' ? toOptions(CATEGORIAS_CUSTOS) : tab === 'variaveis' ? CATEGORIAS_VARIAVEIS : toOptions(FORMAS_TAXAS)}
                value={form.categoria}
                onChange={(categoria) => setForm({ ...form, categoria })}
              />
            </div>
            <Field label={{ custos: 'Valor / Custo Mensal (R$)', variaveis: 'Custo / Valor Base (R$)', taxas: 'Taxa (%)' }[tab]}>
              <NumberInput
                prefix={tab === 'taxas' ? undefined : 'R$'}
                suffix={tab === 'taxas' ? '%' : undefined}
                min={0}
                placeholder="0,00"
                value={form.valor}
                onChange={(valor) => setForm({ ...form, valor })}
              />
            </Field>
            {formError && <p className="error-text" role="alert">{formError}</p>}
          </div>
        </Modal>
      )}

      {toDelete && (
        <Modal
          title="Excluir Registro"
          onClose={() => setToDelete(null)}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setToDelete(null)} disabled={deleting}>Cancelar</button>
              <button type="button" className="btn btn-danger" onClick={confirmDelete} disabled={deleting}>{deleting ? 'Excluindo…' : 'Sim, Excluir'}</button>
            </>
          )}
        >
          <p>Tem certeza que deseja apagar &quot;{toDelete.nome || toDelete.bandeira}&quot;?</p>
        </Modal>
      )}
    </>
  );
}
