import { useState } from 'react';
import { Field, NumberInput, SectionHeader } from '../components/ui';
import { useData } from '../store/DataContext';
import { formatBRL } from '../utils/costCalculations';

export default function Configuracoes() {
  const { settings, saveSettings, resetData } = useData();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [professionalName, setProfessionalName] = useState('');
  const [professionalSpecialty, setProfessionalSpecialty] = useState('');
  const [professionalCost, setProfessionalCost] = useState(0);
  const [editingId, setEditingId] = useState(null);

  const update = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const clearProfessional = () => {
    setEditingId(null);
    setProfessionalName('');
    setProfessionalSpecialty('');
    setProfessionalCost(0);
  };

  const saveProfessional = () => {
    const name = professionalName.trim();
    const specialty = professionalSpecialty.trim();
    if (!name || !specialty) return;

    const professional = {
      id: editingId ?? `professional_${Date.now()}`,
      name,
      specialty,
      defaultCost: Math.max(0, professionalCost),
    };
    const professionals = form.externalProfessionals ?? [];
    update(
      'externalProfessionals',
      editingId ? professionals.map((item) => (item.id === editingId ? professional : item)) : [...professionals, professional],
    );
    clearProfessional();
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(settings);

  return (
    <div className="settings">
      <SectionHeader title="Configurações" description="Valores padrão usados no cálculo de todos os procedimentos." />

      <form
        className="card settings-card"
        onSubmit={(event) => {
          event.preventDefault();
          const next = { ...form, clinicName: form.clinicName.trim() };
          saveSettings(next);
          setForm(next);
          setSaved(true);
        }}
      >
        <section>
          <h2>Clínica</h2>
          <Field label="Nome da clínica">
            <input type="text" value={form.clinicName} onChange={(event) => update('clinicName', event.target.value)} />
          </Field>
        </section>

        <section>
          <h2>Profissionais terceirizados</h2>
          <p className="muted">Cadastre anestesistas, especialistas e seus valores padrão por procedimento.</p>
          {(form.externalProfessionals ?? []).map((professional) => (
            <div key={professional.id} className="professional-row">
              <div className="grow">
                <strong>{professional.name}</strong>
                <small>{professional.specialty} · {formatBRL(professional.defaultCost)} por procedimento</small>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={() => {
                  setEditingId(professional.id);
                  setProfessionalName(professional.name);
                  setProfessionalSpecialty(professional.specialty);
                  setProfessionalCost(professional.defaultCost);
                }}
              >
                Editar
              </button>
              <button
                type="button"
                className="btn btn-danger btn-small"
                onClick={() => {
                  update('externalProfessionals', (form.externalProfessionals ?? []).filter((item) => item.id !== professional.id));
                  if (editingId === professional.id) clearProfessional();
                }}
              >
                Excluir
              </button>
            </div>
          ))}
          <div className="form-row">
            <Field label="Nome">
              <input type="text" placeholder="Ex: Dra. Ana Silva" value={professionalName} onChange={(event) => setProfessionalName(event.target.value)} />
            </Field>
            <Field label="Especialidade">
              <input type="text" placeholder="Ex: Anestesiologia" value={professionalSpecialty} onChange={(event) => setProfessionalSpecialty(event.target.value)} />
            </Field>
            <Field label="Custo padrão por procedimento">
              <NumberInput prefix="R$" min={0} value={professionalCost} onChange={setProfessionalCost} />
            </Field>
          </div>
          <div className="inline">
            <button type="button" className="btn btn-secondary" disabled={!professionalName.trim() || !professionalSpecialty.trim()} onClick={saveProfessional}>
              {editingId ? 'Salvar profissional' : '+ Adicionar profissional'}
            </button>
            {editingId && <button type="button" className="btn btn-ghost" onClick={clearProfessional}>Cancelar edição</button>}
          </div>
        </section>

        <section>
          <h2>Comissões padrão</h2>
          <p className="muted">Aplicado aos procedimentos sem comissão própria e sugerido ao criar novos.</p>
          <div className="form-row">
            <Field label="Cirurgias">
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionSurgeryPercent ?? 0} onChange={(value) => update('defaultVetCommissionSurgeryPercent', value)} />
            </Field>
            <Field label="Internação">
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionInternmentPercent ?? 0} onChange={(value) => update('defaultVetCommissionInternmentPercent', value)} />
            </Field>
            <Field label="Banho & Tosa">
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionBathPercent ?? 0} onChange={(value) => update('defaultVetCommissionBathPercent', value)} />
            </Field>
          </div>
        </section>

        <div className="save-bar">
          {saved && !isDirty && <span className="saved-text">✓ Salvo</span>}
          <button type="submit" className="btn btn-primary" disabled={!isDirty}>Salvar configurações</button>
        </div>
      </form>

      <div className="card reset-card">
        <div>
          <strong>Restaurar dados de exemplo</strong>
          <p className="muted">Substitui todos os procedimentos e insumos pelos dados iniciais. As configurações acima são mantidas.</p>
        </div>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => {
            if (window.confirm('Substituir todos os procedimentos e insumos pelos dados de exemplo? As alterações feitas serão perdidas.')) resetData();
          }}
        >
          Restaurar
        </button>
      </div>
    </div>
  );
}
