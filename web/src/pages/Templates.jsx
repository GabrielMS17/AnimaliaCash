import { useCallback, useEffect, useState } from 'react';
import { Field, Modal, NumberInput, Segmented } from '../components/ui';
import { supabase } from '../supabase';

// Mesma tela do app: os templates ficam na tabela templates_procedimentos do Supabase
const TABS = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Estética', label: 'Estética' },
  { value: 'Cirúrgico', label: 'Cirúrgicos' },
  { value: 'Clínico', label: 'Clínicos' },
];
const CATEGORIAS = TABS.slice(1).map((item) => ({ value: item.value, label: item.value }));
const EMPTY_FORM = { nome: '', categoria: 'Estética', tempo: '', insumos: 0 };

export default function Templates() {
  const [tab, setTab] = useState('Todos');
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('templates_procedimentos').select('*').order('nome', { ascending: true });
    if (error) {
      console.error('Erro ao buscar templates:', error);
      setLoadError(`Não foi possível carregar os templates: ${error.message}`);
    } else {
      setTemplates(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const save = async () => {
    if (!form.nome.trim() || !form.tempo.trim() || !form.insumos) {
      setFormError('Por favor, preencha todos os campos obrigatórios.');
      return;
    }
    setSubmitting(true);
    setFormError('');
    const tempo = form.tempo.trim();
    const { error } = await supabase.from('templates_procedimentos').insert([{
      nome: form.nome.trim(),
      categoria: form.categoria,
      tempo_estimado: tempo.includes('min') ? tempo : `${tempo} min`,
      insumos_count: Math.round(form.insumos),
    }]);
    setSubmitting(false);
    if (error) {
      console.error('Erro ao salvar template:', error);
      setFormError(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
      return;
    }
    setForm(null);
    fetchTemplates();
  };

  const visiveis = templates.filter((item) => tab === 'Todos' || item.categoria === tab);

  return (
    <>
      <div className="page-title">
        <h1>Templates e Fichas Técnicas</h1>
        <p>Pré-configure insumos médios consumidos por procedimento para padronizar custos e lançamentos.</p>
      </div>

      <div className="card metric">
        <div>
          <strong>Templates de Serviços Ativos</strong>
          <small>Padronização de consumo e agilidade na operação diária</small>
        </div>
        <b>{templates.length} ativos</b>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => { setFormError(''); setForm(EMPTY_FORM); }}>
        + Criar Novo Template
      </button>

      <Segmented label="Filtrar por categoria" options={TABS} value={tab} onChange={setTab} />

      {loading ? (
        <p className="empty-text" role="status">Carregando templates…</p>
      ) : loadError ? (
        <p className="error-text" role="alert">{loadError}</p>
      ) : (
        <div className="card table-card">
          <h2>Procedimentos Padronizados</h2>
          <div className="table-scroll">
            <table className="stack-mobile">
              <thead>
                <tr>
                  <th>Nome do Procedimento</th>
                  <th>Categoria</th>
                  <th className="center">Insumos</th>
                  <th className="right">Tempo Est.</th>
                </tr>
              </thead>
              <tbody>
                {visiveis.length === 0 && <tr><td colSpan={4} className="empty-text">Nenhum template encontrado nesta categoria.</td></tr>}
                {visiveis.map((item) => (
                  <tr key={item.id}>
                    <td data-label=""><strong>{item.nome}</strong></td>
                    <td data-label="Categoria">{item.categoria}</td>
                    <td data-label="Insumos" className="center">{item.insumos_count} itens</td>
                    <td data-label="Tempo estimado" className="right accent-text">{item.tempo_estimado}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {form && (
        <Modal
          title="Criar Novo Template de Procedimento"
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
            <Field label="Nome do Procedimento">
              <input
                type="text"
                autoFocus
                placeholder="Ex: Consulta Cardiológica, Castração..."
                value={form.nome}
                onChange={(event) => setForm({ ...form, nome: event.target.value })}
              />
            </Field>
            <div className="field">
              <span className="field-label">Categoria</span>
              <Segmented label="Categoria" options={CATEGORIAS} value={form.categoria} onChange={(categoria) => setForm({ ...form, categoria })} />
            </div>
            <Field label="Tempo Estimado">
              <input type="text" placeholder="Ex: 45 min" value={form.tempo} onChange={(event) => setForm({ ...form, tempo: event.target.value })} />
            </Field>
            <Field label="Quantidade de Insumos Vinculados">
              <NumberInput min={0} placeholder="Ex: 4" value={form.insumos} onChange={(insumos) => setForm({ ...form, insumos })} />
            </Field>
            {formError && <p className="error-text" role="alert">{formError}</p>}
          </div>
        </Modal>
      )}
    </>
  );
}
