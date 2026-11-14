import { useState } from 'react';
import { Field, NumberInput, SectionHeader } from '../components/ui';
import { useAuth } from '../store/AuthContext';
import { useData } from '../store/DataContext';
import { supabase } from '../supabase';
import { formatBRL } from '../utils/costCalculations';

const withoutProfessionals = ({ externalProfessionals, ...rest }) => rest;
const sameFields = (a, b) => JSON.stringify(withoutProfessionals(a)) === JSON.stringify(withoutProfessionals(b));

export default function Configuracoes() {
  const { settings, procedures, saveSettings, saveProfessional, deleteProfessional, resetData } = useData();
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [professionalName, setProfessionalName] = useState('');
  const [professionalSpecialty, setProfessionalSpecialty] = useState('');
  const [professionalCost, setProfessionalCost] = useState(0);
  const [editingId, setEditingId] = useState(null);
  const [professionalMessage, setProfessionalMessage] = useState('');

  // Acompanha mudanças vindas de fora do formulário (ex: dados baixados do Supabase)
  const [lastSettings, setLastSettings] = useState(settings);
  if (settings !== lastSettings) {
    setLastSettings(settings);
    // Mantém o que está sendo digitado se a mudança foi só nos profissionais, que são gravados na hora
    if (sameFields(form, lastSettings)) setForm(settings);
  }

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

  const submitProfessional = () => {
    const name = professionalName.trim();
    const specialty = professionalSpecialty.trim();
    if (!name || !specialty) return;

    const professional = {
      id: editingId ?? `professional_${Date.now()}`,
      name,
      specialty,
      defaultCost: Math.max(0, professionalCost),
    };
    saveProfessional(professional);
    clearProfessional();
    setProfessionalMessage(editingId ? '✓ Profissional atualizado.' : '✓ Profissional cadastrado.');
  };

  const removeProfessional = (professional) => {
    const count = procedures.filter((procedure) =>
      (procedure.externalProfessionalAssignments ?? []).some((item) => item.professionalId === professional.id)).length;
    const message = count > 0
      ? `${professional.name} está em ${count} procedimento(s) e será removido deles, reduzindo o custo. Deseja excluir?`
      : `Deseja excluir ${professional.name}?`;
    if (!window.confirm(message)) return;
    deleteProfessional(professional.id);
    if (editingId === professional.id) clearProfessional();
    setProfessionalMessage('✓ Profissional excluído.');
  };

  const isDirty = !sameFields(form, settings);

  return (
    <div className="settings">
      <SectionHeader title="Configurações" description="Valores padrão usados no cálculo de todos os procedimentos." />

      <form
        className="card settings-card"
        onSubmit={(event) => {
          event.preventDefault();
          const clinicName = form.clinicName.trim();
          saveSettings({ ...settings, ...withoutProfessionals(form), clinicName });
          setForm((prev) => ({ ...prev, clinicName }));
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
          {(settings.externalProfessionals ?? []).map((professional) => (
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
                onClick={() => removeProfessional(professional)}
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
            <button type="button" className="btn btn-secondary" disabled={!professionalName.trim() || !professionalSpecialty.trim()} onClick={submitProfessional}>
              {editingId ? 'Salvar profissional' : '+ Adicionar profissional'}
            </button>
            {editingId && <button type="button" className="btn btn-ghost" onClick={clearProfessional}>Cancelar edição</button>}
            {professionalMessage && <span className="saved-text" role="status">{professionalMessage}</span>}
          </div>
        </section>

        <section>
          <h2>Comissões padrão</h2>
          <p className="muted">Para os profissionais da clínica, aplicado aos procedimentos sem comissão própria. Terceirizados não recebem comissão e o custo deles fica fora do cálculo: a base é o preço menos esse custo ou, sem preço, os insumos mais o custo operacional.</p>
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

      <SyncCard />
      <ChangePasswordCard />

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

function SyncCard() {
  const { user } = useAuth();
  const { autoSync, setAutoSync, syncStatus, pushNow, pullNow } = useData();
  const syncing = syncStatus.state === 'syncing';

  return (
    <div className="card form-group">
      <div>
        <h2>Sincronização com o Supabase</h2>
        <p className="muted">Com login feito, os dados da clínica são enviados para o banco e atualizados com o que outros usuários gravarem.</p>
      </div>
      <p className="muted">Conectado como <strong>{user?.email}</strong></p>
      <label className="checkbox">
        <input type="checkbox" checked={autoSync} onChange={(event) => setAutoSync(event.target.checked)} />
        Sincronizar automaticamente
      </label>
      <div className="inline">
        <button type="button" className="btn btn-primary" disabled={syncing} onClick={pushNow}>
          {syncing ? 'Sincronizando…' : 'Enviar dados agora'}
        </button>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={syncing}
          onClick={() => {
            if (window.confirm('Substituir os dados deste navegador pelos dados salvos no Supabase?')) pullNow();
          }}
        >
          Baixar do Supabase
        </button>
      </div>
      {syncStatus.state === 'ok' && <p className="saved-text" role="status">✓ {syncStatus.message} ({syncStatus.at.toLocaleTimeString('pt-BR')})</p>}
      {syncStatus.state === 'empty' && <p className="warning" role="status">{syncStatus.message}</p>}
      {syncStatus.state === 'error' && <p className="error-text" role="alert">{syncStatus.message}</p>}
    </div>
  );
}

function ChangePasswordCard() {
  const { user } = useAuth();
  const [form, setForm] = useState({ current: '', next: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!user) return null;

  const set = (key) => (event) => setForm({ ...form, [key]: event.target.value });

  const submit = async (event) => {
    event.preventDefault();
    setMessage(null);
    setError(null);
    if (!form.current || !form.next || !form.confirm) {
      setError('Preencha todos os campos de senha.');
      return;
    }
    // Mesmas regras do app: mínimo 10 caracteres, 1 maiúscula e 1 caractere especial
    if (form.next.length < 10) {
      setError('A nova senha deve conter no mínimo 10 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(form.next)) {
      setError('A nova senha deve conter pelo menos uma letra maiúscula.');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.next)) {
      setError('A nova senha deve conter pelo menos um caractere especial.');
      return;
    }
    if (form.next !== form.confirm) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoading(true);
    try {
      // Confirma a senha atual antes de trocar, como no app
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: user.email, password: form.current });
      if (signInError) throw new Error('A senha atual está incorreta.');
      const { error: updateError } = await supabase.auth.updateUser({ password: form.next });
      if (updateError) throw updateError;
      setMessage('Senha alterada com sucesso!');
      setForm({ current: '', next: '', confirm: '' });
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form className="card form-group" onSubmit={submit} noValidate>
      <div>
        <h2>Alterar senha</h2>
        <p className="muted">Atualize sua senha de acesso ao sistema informando a senha atual e a nova senha.</p>
      </div>
      <Field label="Senha atual">
        <input type="password" autoComplete="current-password" placeholder="Digite sua senha atual" value={form.current} onChange={set('current')} />
      </Field>
      <Field label="Nova senha" hint="Mínimo 10 caracteres, 1 letra maiúscula e 1 caractere especial">
        <input type="password" autoComplete="new-password" placeholder="Ex: Senha@12345" value={form.next} onChange={set('next')} />
      </Field>
      <Field label="Confirmar nova senha">
        <input type="password" autoComplete="new-password" placeholder="Digite novamente a nova senha" value={form.confirm} onChange={set('confirm')} />
      </Field>
      <div className="inline">
        <button type="submit" className="btn btn-primary" disabled={loading}>{loading ? 'Alterando…' : 'Atualizar senha'}</button>
      </div>
      {message && <p className="saved-text" role="status">✓ {message}</p>}
      {error && <p className="error-text" role="alert">{error}</p>}
    </form>
  );
}
