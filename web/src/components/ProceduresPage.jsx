import { useMemo, useState } from 'react';
import { useData } from '../store/DataContext';
import { calculateProcedure, formatBRL, formatDuration, matchesWeightRange, WEIGHT_RANGES } from '../utils/costCalculations';
import ProcedureConsumeModal from './ProcedureConsumeModal';
import ProcedureDetailModal from './ProcedureDetailModal';
import ProcedureEditModal from './ProcedureEditModal';
import { SectionHeader, Segmented } from './ui';

const HEADER = {
  banho_tosa: { title: 'Banho & Tosa', description: 'Custo de cada serviço por porte do animal.', newLabel: 'Novo banho & tosa' },
  cirurgia: {
    title: 'Cirurgias',
    description: 'Custo de cada cirurgia por peso do paciente, incluindo os profissionais terceirizados.',
    newLabel: 'Nova cirurgia',
  },
  internacao: { title: 'Internação', description: 'Custo das diárias de internação por porte do animal.', newLabel: 'Nova diária' },
};

const WEIGHT_OPTIONS = WEIGHT_RANGES.map((range) => ({ value: range.id, label: range.label }));

/** Página de Cirurgias, Internação ou Banho & Tosa: lista, filtros e cadastro de procedimentos. */
export default function ProceduresPage({ category }) {
  const { procedures, insumos, insumosMap, settings, saveProcedure, duplicateProcedure, deleteProcedure, saveInsumo, saveProfessional, flushPending } = useData();
  const [search, setSearch] = useState('');
  const [weightRange, setWeightRange] = useState('todos');
  const [detail, setDetail] = useState(null);
  const [editing, setEditing] = useState(null); // null = fechado, {} = novo, procedimento = edição
  const [consuming, setConsuming] = useState(null); // { procedure } sendo registrado; procedure null = escolher na lista
  const [notice, setNotice] = useState('');
  const [justCreated, setJustCreated] = useState(null); // ficha nova: oferece registrar um atendimento

  const header = HEADER[category];
  const categoryProcedures = useMemo(() => procedures.filter((procedure) => procedure.category === category), [procedures, category]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return categoryProcedures
      .filter((procedure) => matchesWeightRange(procedure.targetWeightKg, weightRange))
      .filter((procedure) => !query || procedure.name.toLowerCase().includes(query) || procedure.description.toLowerCase().includes(query))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || (a.targetWeightKg ?? 0) - (b.targetWeightKg ?? 0));
  }, [categoryProcedures, search, weightRange]);

  const isFiltering = weightRange !== 'todos' || search.trim() !== '';

  const handleDelete = (procedure) => {
    if (window.confirm(`Remover "${procedure.name}"?`)) deleteProcedure(procedure.id);
  };

  return (
    <>
      <SectionHeader
        title={header.title}
        description={header.description}
        action={(
          <div className="header-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={categoryProcedures.length === 0}
              onClick={() => { setNotice(''); setJustCreated(null); setConsuming({ procedure: null }); }}
            >
              Novo atendimento
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setEditing({})}>+ {header.newLabel}</button>
          </div>
        )}
      />

      {notice && <p className="saved-text" role="status">✓ {notice}</p>}
      {justCreated && (
        <div className="notice-box offer-box" role="status">
          <span>✓ <strong>{justCreated.name}</strong> cadastrado. Quer registrar um atendimento com ele agora?</span>
          <span className="offer-actions">
            <button type="button" className="btn btn-primary btn-small" onClick={() => { setConsuming({ procedure: justCreated }); setJustCreated(null); }}>
              Registrar atendimento
            </button>
            <button type="button" className="btn btn-ghost btn-small" onClick={() => setJustCreated(null)}>Agora não</button>
          </span>
        </div>
      )}

      <div className="filters">
        <Segmented label="Filtrar por peso" options={WEIGHT_OPTIONS} value={weightRange} onChange={setWeightRange} />
        <input type="search" aria-label="Buscar procedimento" placeholder="Buscar procedimento" value={search} onChange={(event) => setSearch(event.target.value)} />
      </div>

      {visible.length > 0 ? (
        <>
          <p className="count">{visible.length} de {categoryProcedures.length} procedimentos</p>
          <div className="card-grid">
            {visible.map((procedure) => (
              <ProcedureCard
                key={procedure.id}
                procedure={procedure}
                insumosMap={insumosMap}
                settings={settings}
                onOpen={() => setDetail(procedure)}
                onEdit={() => setEditing(procedure)}
                onDuplicate={() => duplicateProcedure(procedure)}
                onRegister={() => { setNotice(''); setJustCreated(null); setConsuming({ procedure }); }}
                onDelete={() => handleDelete(procedure)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-box">
          <strong>{isFiltering ? 'Nenhum procedimento encontrado.' : 'Nenhum procedimento cadastrado ainda.'}</strong>
          <span className="muted">
            {isFiltering ? 'Tente outra faixa de peso ou outro termo de busca.' : `Clique em "${header.newLabel}" para começar.`}
          </span>
          {isFiltering && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setWeightRange('todos');
                setSearch('');
              }}
            >
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {detail && (
        <ProcedureDetailModal
          procedure={detail}
          insumosMap={insumosMap}
          settings={settings}
          onClose={() => setDetail(null)}
          onEdit={(procedure) => {
            setDetail(null);
            setEditing(procedure);
          }}
        />
      )}

      {consuming && (
        <ProcedureConsumeModal
          procedure={consuming.procedure}
          procedures={categoryProcedures}
          insumos={insumos}
          insumosMap={insumosMap}
          settings={settings}
          flushPending={flushPending}
          onClose={() => setConsuming(null)}
          onDone={({ procedure, times, status, date, adjusted }) => {
            const when = date.split('-').reverse().join('/');
            const qty = times === 1 ? '' : ` (${times}x)`;
            setNotice(status === 'agendado'
              ? `${procedure.name}${qty}: agendado para ${when}.`
              : `${procedure.name}${qty}: atendimento de ${when} registrado e ${adjusted ? 'itens usados (com ajuste na ficha)' : 'itens da ficha'} baixados do estoque.`);
            setConsuming(null);
          }}
        />
      )}

      {editing && (
        <ProcedureEditModal
          procedure={editing.id ? editing : null}
          defaultCategory={category}
          insumos={insumos}
          insumosMap={insumosMap}
          settings={settings}
          onClose={() => setEditing(null)}
          onSave={(saved) => {
            const isNew = !editing.id;
            saveProcedure(saved);
            setEditing(null);
            setNotice('');
            setJustCreated(isNew ? saved : null);
          }}
          onQuickCreateInsumo={saveInsumo}
          onQuickCreateProfessional={saveProfessional}
        />
      )}
    </>
  );
}

function ProcedureCard({ procedure, insumosMap, settings, onOpen, onEdit, onDuplicate, onDelete, onRegister }) {
  const calc = calculateProcedure(procedure, insumosMap, settings);
  const hasMissingItems = calc.itemDetails.some((item) => item.missing);

  const meta = [
    procedure.targetWeightKg ? `${procedure.targetWeightKg} kg` : null,
    formatDuration(procedure.durationMinutes, procedure.category),
    `${procedure.items.length} ${procedure.items.length === 1 ? 'insumo' : 'insumos'}`,
  ].filter(Boolean);

  return (
    <article className="procedure-card">
      <button type="button" className="procedure-open" onClick={onOpen}>
        <span className="procedure-name">{procedure.name}</span>
        <span className="procedure-meta">{meta.join(' · ')}</span>
        <span className="procedure-footer">
          <span>
            <small>Custo total</small>
            <strong>{formatBRL(calc.breakdown.totalCost)}</strong>
          </span>
          {hasMissingItems && <span className="warning">⚠ Revisar insumos</span>}
        </span>
      </button>
      <div className="procedure-actions">
        <button type="button" className="btn btn-ghost btn-small" onClick={onRegister}>Registrar atendimento</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onEdit}>Editar</button>
        <button type="button" className="btn btn-ghost btn-small" onClick={onDuplicate}>Duplicar</button>
        <button type="button" className="btn btn-ghost btn-small push-right" onClick={onDelete}>Excluir</button>
      </div>
    </article>
  );
}
