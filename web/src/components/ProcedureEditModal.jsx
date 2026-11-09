import { useMemo, useState } from 'react';
import {
  calculateProcedure,
  formatBRL,
  formatDecimal,
  formatUnitCost,
  getCategoryLabel,
  getDefaultCommissionPercent,
} from '../utils/costCalculations';
import { UNIT_OPTIONS } from './InsumoModal';
import { Field, Modal, NumberInput, Segmented } from './ui';

const COMMON_SURGERIES = [
  'Castração Fêmea',
  'Castração Macho',
  'Tartarectomia (Limpeza de Tártaro)',
  'Cesariana de Emergência',
  'Piometra',
  'Osteossíntese de Fêmur',
  'Enucleação Ocular',
  'Mastectomia Total / Parcial',
  'Laparotomia Exploratória',
];

const DEFAULT_ROLE = {
  cirurgia: 'Cirurgião Veterinário',
  internacao: 'Veterinário Plantonista',
  banho_tosa: 'Banhista / Tosador',
};

const NOUN = {
  cirurgia: { edit: 'Editar cirurgia', create: 'Nova cirurgia' },
  banho_tosa: { edit: 'Editar banho & tosa', create: 'Novo banho & tosa' },
  internacao: { edit: 'Editar diária de internação', create: 'Nova diária de internação' },
};

function getAutoName(category, weight) {
  if (category === 'banho_tosa') return weight ? `Banho & Tosa (${weight} kg)` : 'Banho & Tosa';
  if (category === 'internacao') return weight ? `Diária de Internação (${weight} kg)` : 'Diária de Internação';
  return '';
}

export default function ProcedureEditModal({ procedure, defaultCategory, insumos, insumosMap, settings, onClose, onSave, onQuickCreateInsumo, onQuickCreateProfessional }) {
  const category = procedure?.category ?? defaultCategory;
  const isEditing = Boolean(procedure);

  const [tab, setTab] = useState('geral');
  const [error, setError] = useState('');

  // Nomes automáticos (ex: "Banho & Tosa (20 kg)") ficam vazios para acompanhar a mudança de peso
  const [name, setName] = useState(() =>
    procedure && procedure.name !== getAutoName(category, procedure.targetWeightKg) ? procedure.name : '',
  );
  const [targetWeightKg, setTargetWeightKg] = useState(procedure?.targetWeightKg ?? 0);
  const [durationMinutes, setDurationMinutes] = useState(procedure?.durationMinutes ?? (category === 'internacao' ? 1440 : 60));
  const [laborMinutes, setLaborMinutes] = useState(procedure?.laborMinutes ?? 180);
  const [description, setDescription] = useState(procedure?.description ?? '');

  const [assignments, setAssignments] = useState(() =>
    (procedure?.externalProfessionalAssignments ?? []).map((assignment) => ({ ...assignment })),
  );
  const [professionalToAdd, setProfessionalToAdd] = useState('');
  const [professionalFormOpen, setProfessionalFormOpen] = useState(false);
  const [commissionType, setCommissionType] = useState(procedure?.vetCommissionType ?? 'percent');
  const [commissionValue, setCommissionValue] = useState(procedure?.vetCommissionValue ?? getDefaultCommissionPercent(category, settings));
  const [commissionRole, setCommissionRole] = useState(procedure?.vetCommissionRole ?? DEFAULT_ROLE[category]);
  const [price, setPrice] = useState(procedure?.suggestedPrice ?? 0);

  // Cópia própria dos itens, para que "Cancelar" não altere o procedimento original
  const [items, setItems] = useState(() => (procedure?.items ?? []).map((item) => ({ ...item })));
  const [search, setSearch] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);

  const autoName = getAutoName(category, targetWeightKg);
  const finalName = name.trim() || autoName;

  const draft = {
    ...procedure,
    id: procedure?.id ?? 'novo',
    name: finalName,
    category,
    description: description.trim(),
    targetWeightKg: targetWeightKg > 0 ? targetWeightKg : undefined,
    durationMinutes: Math.max(1, Math.round(durationMinutes)),
    laborMinutes: category === 'internacao' ? Math.max(0, laborMinutes) : procedure?.laborMinutes,
    anesthesiaCost: category === 'cirurgia' ? 0 : procedure?.anesthesiaCost,
    externalProfessionalAssignments: category === 'cirurgia' && assignments.length > 0
      ? assignments.map((assignment) => ({ ...assignment, cost: Math.max(0, assignment.cost) }))
      : undefined,
    vetCommissionType: commissionType,
    vetCommissionValue: Math.max(0, commissionValue),
    vetCommissionRole: commissionRole.trim() || undefined,
    suggestedPrice: price > 0 ? price : undefined,
    items,
  };
  const { breakdown } = calculateProcedure(draft, insumosMap, settings);

  // Catálogo: só os insumos da mesma categoria do procedimento
  const categoryInsumos = useMemo(
    () => insumos.filter((insumo) => insumo.category === category).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [insumos, category],
  );
  const catalog = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? categoryInsumos.filter((insumo) => insumo.name.toLowerCase().includes(query) || (insumo.notes ?? '').toLowerCase().includes(query))
      : categoryInsumos;
  }, [categoryInsumos, search]);
  const addedQuantity = new Map(items.map((item) => [item.insumoId, item.quantity]));

  const availableProfessionals = (settings.externalProfessionals ?? []).filter(
    (professional) => !assignments.some((item) => item.professionalId === professional.id),
  );

  const addProfessional = () => {
    const professional = settings.externalProfessionals?.find((item) => item.id === professionalToAdd);
    if (!professional) return;
    setAssignments((prev) => [...prev, { professionalId: professional.id, cost: professional.defaultCost }]);
    setProfessionalToAdd('');
  };

  const updateItem = (index, patch) => setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));

  const addInsumo = (insumoId) => setItems((prev) => {
    const existing = prev.findIndex((item) => item.insumoId === insumoId);
    if (existing >= 0) {
      return prev.map((item, i) => (i === existing ? { ...item, quantity: Math.round((item.quantity + 1) * 1000) / 1000 } : item));
    }
    return [...prev, { insumoId, quantity: 1 }];
  });

  const fail = (targetTab, message) => {
    setTab(targetTab);
    setError(message);
  };

  const handleSave = () => {
    if (!finalName) return fail('geral', 'Informe o nome da cirurgia.');
    if (finalName.length > 150) return fail('geral', 'O nome é muito longo (máximo de 150 caracteres).');
    if (durationMinutes <= 0) return fail('geral', 'A duração deve ser maior que zero.');
    if (description.trim().length > 500) return fail('geral', 'A descrição é muito longa (máximo de 500 caracteres).');
    const invalidItem = items.findIndex((item) => !(item.quantity > 0));
    if (invalidItem >= 0) return fail('insumos', `A quantidade do item #${invalidItem + 1} deve ser maior que zero.`);
    if (commissionType === 'percent' && commissionValue > 100) return fail('custos', 'O percentual de comissão não pode ultrapassar 100%.');
    return onSave({ ...draft, id: procedure?.id ?? `proc_${Date.now()}` });
  };

  const tabs = [
    { value: 'geral', label: 'Dados gerais' },
    { value: 'insumos', label: `Insumos (${items.length})` },
    { value: 'custos', label: 'Custos' },
  ];

  return (
    <Modal
      wide
      title={isEditing ? NOUN[category].edit : NOUN[category].create}
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <div className="footer-total">
          <div>
            <small>Custo total</small>
            <strong>{formatBRL(breakdown.totalCost)}</strong>
          </div>
          <div className="actions-end">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="btn btn-primary">{isEditing ? 'Salvar alterações' : 'Criar procedimento'}</button>
          </div>
        </div>
      }
    >
      <Segmented label="Seções do formulário" options={tabs} value={tab} onChange={setTab} />
      {error && <div className="error-banner" role="alert">{error}</div>}

      {tab === 'geral' && (
        <div className="form-group">
          <Field
            label={category === 'cirurgia' ? 'Nome' : 'Nome (opcional)'}
            hint={category === 'cirurgia' ? undefined : `Se deixar em branco, será usado "${autoName}".`}
          >
            <input
              type="text"
              placeholder={category === 'cirurgia' ? 'Ex: Castração Fêmea' : autoName}
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setError('');
              }}
            />
          </Field>
          {category === 'cirurgia' && !name.trim() && (
            <div className="chips">
              {COMMON_SURGERIES.map((surgery) => (
                <button key={surgery} type="button" onClick={() => setName(surgery)}>{surgery}</button>
              ))}
            </div>
          )}

          <div className="form-row">
            <Field label="Peso do animal">
              <NumberInput suffix="kg" min={0} value={targetWeightKg} onChange={setTargetWeightKg} />
            </Field>
            {category === 'internacao' ? (
              <Field label="Duração">
                <NumberInput suffix="diárias" min={0.25} value={Math.round((durationMinutes / 1440) * 100) / 100} onChange={(days) => setDurationMinutes(Math.round(days * 1440))} />
              </Field>
            ) : (
              <Field label="Duração">
                <NumberInput suffix="min" min={1} value={durationMinutes} onChange={setDurationMinutes} />
              </Field>
            )}
            {category === 'internacao' && (
              <Field label="Tempo de atendimento" hint="Horas da equipe no período; é o que entra no custo operacional.">
                <NumberInput suffix="h" min={0} value={Math.round((laborMinutes / 60) * 100) / 100} onChange={(hours) => setLaborMinutes(Math.round(hours * 60))} />
              </Field>
            )}
          </div>

          <Field label="Descrição (opcional)">
            <textarea rows={3} placeholder="Protocolo, observações clínicas…" value={description} onChange={(event) => setDescription(event.target.value)} />
          </Field>
        </div>
      )}

      {tab === 'insumos' && (
        <div className="two-columns">
          <section>
            <div className="list-header">
              <h3>Insumos de {getCategoryLabel(category)} <span className="muted">({categoryInsumos.length})</span></h3>
              <button type="button" className="btn btn-ghost btn-small" onClick={() => setQuickCreateOpen((open) => !open)}>
                {quickCreateOpen ? 'Fechar' : '+ Cadastrar'}
              </button>
            </div>

            {quickCreateOpen && (
              <QuickCreateInsumo
                category={category}
                onCancel={() => setQuickCreateOpen(false)}
                onCreate={(insumo) => {
                  onQuickCreateInsumo(insumo);
                  setItems((prev) => [...prev, { insumoId: insumo.id, quantity: 1 }]);
                  setQuickCreateOpen(false);
                }}
              />
            )}

            <input type="search" aria-label="Filtrar insumos" placeholder="Filtrar" value={search} onChange={(event) => setSearch(event.target.value)} className="mb-8" />

            <div className="box">
              {catalog.map((insumo) => {
                const added = addedQuantity.get(insumo.id);
                return (
                  <button key={insumo.id} type="button" className="catalog-row" onClick={() => addInsumo(insumo.id)}>
                    <span className="catalog-main">
                      <span className="truncate">{insumo.name}</span>
                      <small>{formatUnitCost(insumo.costPerUnit)} / {insumo.unit}</small>
                    </span>
                    {added !== undefined
                      ? <span className="added-badge">✓ {formatDecimal(added, 3)} {insumo.unit}</span>
                      : <span className="plus">+</span>}
                  </button>
                );
              })}
              {catalog.length === 0 && (
                <p className="empty-text">
                  {categoryInsumos.length === 0 ? `Nenhum insumo cadastrado na categoria ${getCategoryLabel(category)}.` : 'Nenhum insumo encontrado.'}
                </p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-8">Adicionados <span className="muted">({items.length})</span></h3>
            {items.length > 0 ? (
              <div className="box">
                {items.map((item, index) => {
                  const insumo = insumosMap.get(item.insumoId);
                  return (
                    <div key={`${item.insumoId}-${index}`} className="added-row">
                      <div className="added-main">
                        <span className={`truncate ${insumo ? '' : 'warning'}`}>{insumo ? insumo.name : `⚠ Não encontrado (${item.insumoId})`}</span>
                        <input
                          type="text"
                          className="note-input"
                          aria-label="Observação do item"
                          placeholder="Adicionar observação"
                          value={item.notes ?? ''}
                          onChange={(event) => updateItem(index, { notes: event.target.value })}
                        />
                      </div>
                      <NumberInput
                        min={0}
                        label={`Quantidade de ${insumo?.name ?? item.insumoId}`}
                        suffix={insumo?.unit ?? ''}
                        value={item.quantity}
                        onChange={(quantity) => updateItem(index, { quantity })}
                        className="w-qty"
                      />
                      <b className="item-cost">{formatBRL((item.quantity || 0) * (insumo?.costPerUnit ?? 0))}</b>
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        aria-label={`Remover ${insumo?.name ?? 'item'}`}
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== index))}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
                <div className="box-total">
                  <span className="muted">Total de insumos</span>
                  <strong>{formatBRL(breakdown.directCost)}</strong>
                </div>
              </div>
            ) : (
              <div className="empty-box">
                <strong>Nenhum insumo adicionado.</strong>
                <span className="muted">Clique em um insumo da lista para incluí-lo.</span>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === 'custos' && (
        <div className="two-columns costs-columns">
          <div className="form-group">
            {category === 'cirurgia' && (
              <section className="form-group">
                <div className="list-header">
                  <h3>Profissionais terceirizados</h3>
                  <button type="button" className="btn btn-ghost btn-small" onClick={() => setProfessionalFormOpen((open) => !open)}>
                    {professionalFormOpen ? 'Fechar' : '+ Cadastrar'}
                  </button>
                </div>
                {professionalFormOpen && (
                  <QuickCreateProfessional
                    onCreate={(professional) => {
                      onQuickCreateProfessional(professional);
                      setAssignments((prev) => [...prev, { professionalId: professional.id, cost: professional.defaultCost }]);
                      setProfessionalFormOpen(false);
                    }}
                  />
                )}
                <div className="inline">
                  <select aria-label="Profissional terceirizado" className="grow" value={professionalToAdd} onChange={(event) => setProfessionalToAdd(event.target.value)}>
                    <option value="">{availableProfessionals.length > 0 ? 'Selecione anestesista ou especialista' : 'Nenhum outro profissional disponível'}</option>
                    {availableProfessionals.map((professional) => (
                      <option key={professional.id} value={professional.id}>{professional.name} · {professional.specialty}</option>
                    ))}
                  </select>
                  <button type="button" className="btn btn-secondary" disabled={!professionalToAdd} onClick={addProfessional}>Adicionar</button>
                </div>
                {availableProfessionals.length === 0 && (
                  <p className="hint">
                    {(settings.externalProfessionals ?? []).length === 0
                      ? 'Nenhum profissional cadastrado. Use "+ Cadastrar" para incluir o primeiro.'
                      : 'Todos os profissionais cadastrados já estão neste procedimento. Use "+ Cadastrar" para incluir outro.'}
                  </p>
                )}
                {assignments.map((assignment) => {
                  const professional = settings.externalProfessionals?.find((item) => item.id === assignment.professionalId);
                  return (
                    <div key={assignment.professionalId} className="professional-row">
                      <div className="grow">
                        <span>{professional?.name ?? 'Profissional não cadastrado'}</span>
                        <small>{professional?.specialty}</small>
                      </div>
                      <NumberInput
                        prefix="R$"
                        min={0}
                        label={`Custo de ${professional?.name ?? 'profissional'}`}
                        value={assignment.cost}
                        onChange={(cost) => setAssignments((prev) => prev.map((item) => (item.professionalId === assignment.professionalId ? { ...item, cost } : item)))}
                        className="w-small"
                      />
                      <button
                        type="button"
                        className="btn btn-danger btn-small"
                        aria-label={`Remover ${professional?.name ?? 'profissional'}`}
                        onClick={() => setAssignments((prev) => prev.filter((item) => item.professionalId !== assignment.professionalId))}
                      >
                        ✕
                      </button>
                    </div>
                  );
                })}
              </section>
            )}

            {category === 'cirurgia' && (
              <section className="form-group">
                <h3>Comissão do profissional da clínica</h3>
                <Field label="Profissional">
                  <input type="text" value={commissionRole} onChange={(event) => setCommissionRole(event.target.value)} />
                </Field>
                <div className="form-row">
                  <div className="field">
                    <span className="field-label">Tipo</span>
                    <Segmented
                      label="Tipo de comissão"
                      options={[{ value: 'percent', label: 'Percentual' }, { value: 'fixed', label: 'Valor fixo' }]}
                      value={commissionType}
                      onChange={setCommissionType}
                    />
                  </div>
                  <Field label={commissionType === 'percent' ? 'Percentual' : 'Valor'}>
                    {commissionType === 'percent'
                      ? <NumberInput suffix="%" min={0} max={100} value={commissionValue} onChange={setCommissionValue} />
                      : <NumberInput prefix="R$" min={0} value={commissionValue} onChange={setCommissionValue} />}
                  </Field>
                </div>
              </section>
            )}

            <Field
              label="Preço cobrado do tutor (opcional)"
              hint="Quando informado, a comissão percentual é calculada sobre este preço menos o custo dos terceirizados. Sem preço, ela incide sobre os insumos e o custo operacional."
            >
              <NumberInput prefix="R$" min={0} placeholder="0,00" value={price} onChange={setPrice} />
            </Field>
          </div>

          <aside className="summary">
            <h3>Composição do custo</h3>
            <SummaryRow label="Insumos" value={breakdown.directCost} />
            {breakdown.externalProfessionalCost > 0 && <SummaryRow label="Profissionais terceirizados" value={breakdown.externalProfessionalCost} />}
            <SummaryRow label="Comissão" value={breakdown.vetCommissionCost} />
            <SummaryRow label="Operacional" value={breakdown.operationalCost} />
            <div className="summary-total">
              <strong>Total</strong>
              <strong>{formatBRL(breakdown.totalCost)}</strong>
            </div>
            <p className="hint">
              Operacional: {category === 'internacao' ? 'tempo de atendimento' : 'duração'} × {formatBRL(settings.hourlyOperationalRate)}/h da clínica.
            </p>
          </aside>
        </div>
      )}
    </Modal>
  );
}

function QuickCreateProfessional({ onCreate }) {
  const [name, setName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [cost, setCost] = useState(0);

  return (
    <div className="quick-create">
      <h3>Novo profissional</h3>
      <input type="text" aria-label="Nome do profissional" placeholder="Nome (ex: Dra. Ana Silva)" value={name} onChange={(event) => setName(event.target.value)} />
      <input type="text" aria-label="Especialidade" placeholder="Especialidade (ex: Anestesiologia)" value={specialty} onChange={(event) => setSpecialty(event.target.value)} />
      <NumberInput prefix="R$" min={0} label="Custo por procedimento" placeholder="Custo por procedimento" value={cost} onChange={setCost} />
      <div className="actions-end">
        <button
          type="button"
          className="btn btn-primary btn-small"
          disabled={!name.trim() || !specialty.trim()}
          onClick={() => onCreate({ id: `professional_${Date.now()}`, name: name.trim(), specialty: specialty.trim(), defaultCost: Math.max(0, cost) })}
        >
          Adicionar profissional
        </button>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="summary-row">
      <span>{label}</span>
      <span>{formatBRL(value)}</span>
    </div>
  );
}

function QuickCreateInsumo({ category, onCancel, onCreate }) {
  const [name, setName] = useState('');
  const [cost, setCost] = useState(0);
  const [unit, setUnit] = useState('un');
  const [error, setError] = useState('');

  const handleCreate = () => {
    const cleanName = name.trim();
    if (!cleanName) return setError('Informe o nome do insumo.');
    if (cleanName.length > 100) return setError('O nome do insumo é muito longo.');
    if (cost <= 0) return setError('Informe um custo maior que zero.');
    return onCreate({ id: `ins_custom_${Date.now()}`, name: cleanName, category, unit, costPerUnit: cost });
  };

  return (
    <div className="quick-create">
      <h3>Novo insumo</h3>
      {error && <p className="error-text" role="alert">{error}</p>}
      <input type="text" aria-label="Nome do insumo" placeholder="Nome" value={name} onChange={(event) => setName(event.target.value)} />
      <div className="inline">
        <NumberInput prefix="R$" min={0} label="Custo por unidade" placeholder="Custo" value={cost} onChange={setCost} className="grow" />
        <select aria-label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
          {UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.value}</option>)}
        </select>
      </div>
      <div className="actions-end">
        <button type="button" className="btn btn-secondary btn-small" onClick={onCancel}>Cancelar</button>
        <button type="button" className="btn btn-primary btn-small" onClick={handleCreate}>Adicionar ao procedimento</button>
      </div>
    </div>
  );
}
