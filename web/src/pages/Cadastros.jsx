import { useCallback, useEffect, useState } from 'react';
import { Field, Modal, Segmented } from '../components/ui';
import { signUpClient, supabase } from '../supabase';
import { buildCrmv, CFMV_CONSULTA_URL, formatCrmv, onlyCrmvDigits, parseCrmv, UFS, validateCrmv, verificationLabel } from '../utils/crmv';

// Mesma tela do app: cria a conta no Supabase Auth e o perfil na tabela profiles
const ROLES = [
  { value: 'Administrador', label: 'Administrador' },
  { value: 'Veterinário', label: 'Veterinário' },
  { value: 'Esteticista Animal', label: 'Esteticista Animal' },
];
const EMPTY_FORM = { nome: '', email: '', senha: '', role: 'Veterinário', crmvUf: '', crmv: '' };

export default function Cadastros() {
  const [perfis, setPerfis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [statusError, setStatusError] = useState('');
  const [crmvNotice, setCrmvNotice] = useState('');

  const fetchProfiles = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase.from('profiles').select('*').order('nome', { ascending: true });
    if (error) {
      console.error('Erro ao buscar perfis:', error);
      setLoadError(`Não foi possível carregar os perfis: ${error.message}`);
    } else {
      setPerfis(data ?? []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfiles();
  }, [fetchProfiles]);

  const save = async () => {
    if (!form.nome.trim() || !form.email.trim() || !form.senha) {
      setFormError('Por favor, preencha o Nome, o E-mail institucional e a Senha provisória.');
      return;
    }
    // Mesmas regras do app: mínimo 10 caracteres, 1 maiúscula e 1 caractere especial
    if (form.senha.length < 10) {
      setFormError('A senha provisória deve conter no mínimo 10 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(form.senha)) {
      setFormError('A senha provisória deve conter pelo menos uma letra maiúscula.');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(form.senha)) {
      setFormError('A senha provisória deve conter pelo menos um caractere especial.');
      return;
    }
    // CRMV do veterinário: UF do conselho regional + número (só dígitos), igual ao app
    if (form.role === 'Veterinário') {
      const crmvError = validateCrmv(form.crmvUf, form.crmv);
      if (crmvError) {
        setFormError(crmvError);
        return;
      }
    }

    setSubmitting(true);
    setFormError('');
    try {
      const email = form.email.trim();
      const { data: authData, error: authError } = await signUpClient.auth.signUp({
        email,
        password: form.senha,
        options: { data: { nome: form.nome.trim(), role: form.role } },
      });
      if (authError) throw authError;
      const userId = authData.user?.id;
      if (!userId) throw new Error('Não foi possível obter o ID de autenticação do usuário.');

      const { error: profileError } = await supabase.from('profiles').insert([{
        id: userId,
        nome: form.nome.trim(),
        email,
        role: form.role,
        crmv: form.role === 'Veterinário' ? buildCrmv(form.crmvUf, form.crmv) : null,
        status: 'Ativo',
      }]);
      if (profileError) throw profileError;

      setForm(null);
      setSuccess(true);
      fetchProfiles();
    } catch (error) {
      console.error('Erro ao cadastrar perfil:', error);
      setFormError(`Erro ao cadastrar: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setSubmitting(false);
    }
  };

  // Abre a consulta oficial do CFMV e copia o número do CRMV para colar na busca
  const openCfmv = async (perfil) => {
    const { uf, number } = parseCrmv(perfil.crmv);
    const conselho = uf ? ` (conselho CRMV-${uf})` : '';
    window.open(CFMV_CONSULTA_URL, '_blank', 'noopener');
    try {
      await navigator.clipboard.writeText(number);
      setCrmvNotice(`Número ${number} copiado. Na consulta do CFMV, cole no campo de inscrição e confira se o nome bate, se o conselho é o mesmo${conselho} e se o registro está ativo.`);
    } catch {
      setCrmvNotice(`Na consulta do CFMV, busque pelo número ${number}${conselho} e confira se o nome bate e se o registro está ativo.`);
    }
  };

  // Marca (ou desmarca) que um administrador conferiu o CRMV no site do CFMV
  const setVerified = async (perfil, verified) => {
    setStatusError('');
    const { data: auth } = await supabase.auth.getUser();
    const changes = verified
      ? { crmv_verificado_em: new Date().toISOString(), crmv_verificado_por: auth.user?.id ?? null }
      : { crmv_verificado_em: null, crmv_verificado_por: null };
    const { error } = await supabase.from('profiles').update(changes).eq('id', perfil.id);
    if (error) {
      const missingColumn = error.code === '42703' || error.code === 'PGRST204';
      setStatusError(missingColumn
        ? 'A verificação do CRMV ainda não foi criada no banco (falta rodar supabase/atendimentos.sql).'
        : `Erro ao salvar a verificação: ${error.message}`);
      return;
    }
    setCrmvNotice('');
    fetchProfiles();
  };

  const toggleStatus = async (perfil) => {
    setStatusError('');
    const status = perfil.status === 'Inativo' ? 'Ativo' : 'Inativo';
    const { error } = await supabase.from('profiles').update({ status }).eq('id', perfil.id);
    if (error) {
      console.error('Erro ao atualizar status:', error);
      setStatusError(`Erro ao atualizar status: ${error.message}`);
      return;
    }
    fetchProfiles();
  };

  const ativos = perfis.filter((perfil) => perfil.status !== 'Inativo').length;

  return (
    <>
      <div className="hero-banner">
        <div>
          <h1>Gestão de Colaboradores</h1>
          <p>Controle de acessos, credenciais de login e ativação de contas.</p>
        </div>
        <div className="hero-counter">
          <b>{ativos}</b>
          <span>Ativos</span>
        </div>
      </div>

      <button type="button" className="btn btn-primary btn-block" onClick={() => { setFormError(''); setForm(EMPTY_FORM); }}>
        + Adicionar Novo Colaborador
      </button>
      {statusError && <p className="error-text" role="alert">{statusError}</p>}
      {crmvNotice && <div className="notice-box" role="status">{crmvNotice}</div>}

      {loading ? (
        <p className="empty-text" role="status">Carregando perfis…</p>
      ) : loadError ? (
        <p className="error-text" role="alert">{loadError}</p>
      ) : perfis.length === 0 ? (
        <div className="card empty-text">
          <p><strong>Nenhum perfil encontrado</strong></p>
          <p>Ainda não existem colaboradores registrados na tabela profiles. Clique no botão acima para começar.</p>
        </div>
      ) : (
        <div className="profile-list">
          {perfis.map((perfil) => {
            const inactive = perfil.status === 'Inativo';
            const roleClass = { Administrador: 'role-admin', 'Esteticista Animal': 'role-groomer' }[perfil.role] ?? 'role-vet';
            return (
              <div key={perfil.id} className={`card profile-card ${roleClass} ${inactive ? 'inactive' : ''}`}>
                <div className="profile-top">
                  <div className="profile-id">
                    <span className="profile-avatar">{perfil.nome ? perfil.nome.charAt(0).toUpperCase() : 'U'}</span>
                    <span className="role-badge">{perfil.role || 'Colaborador'}</span>
                  </div>
                  <button
                    type="button"
                    className={`btn btn-small ${inactive ? 'btn-activate' : 'btn-danger'}`}
                    onClick={() => toggleStatus(perfil)}
                  >
                    {inactive ? 'Ativar' : 'Desativar'}
                  </button>
                </div>
                <strong className="profile-name">{perfil.nome}</strong>
                <span className="profile-email">{perfil.email || 'E-mail não registrado'}</span>
                {perfil.role === 'Veterinário' && (
                  <div className="profile-crmv">
                    <span>CRMV: <b>{formatCrmv(perfil.crmv)}</b></span>
                    <span className={perfil.crmv_verificado_em ? 'crmv-badge ok' : 'crmv-badge pending'}>
                      {perfil.crmv_verificado_em ? `✓ ${verificationLabel(perfil.crmv_verificado_em)}` : 'Não verificado no CFMV'}
                    </span>
                    {perfil.crmv && (
                      <span className="crmv-actions">
                        <button type="button" className="btn btn-secondary btn-small" onClick={() => openCfmv(perfil)}>Conferir no CFMV ↗</button>
                        {perfil.crmv_verificado_em ? (
                          <button type="button" className="btn btn-ghost btn-small" onClick={() => setVerified(perfil, false)}>Remover verificação</button>
                        ) : (
                          <button type="button" className="btn btn-primary btn-small" onClick={() => setVerified(perfil, true)}>Marcar como verificado</button>
                        )}
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {form && (
        <Modal
          title="Cadastrar Novo Colaborador"
          onClose={() => setForm(null)}
          onSubmit={save}
          footer={(
            <>
              <button type="button" className="btn btn-secondary" onClick={() => setForm(null)}>Cancelar</button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>{submitting ? 'Criando…' : 'Criar Conta e Salvar'}</button>
            </>
          )}
        >
          <div className="form-group">
            <Field label="Nome Completo *">
              <input type="text" autoFocus placeholder="Ex: Dra. Amanda Silva" value={form.nome} onChange={(event) => setForm({ ...form, nome: event.target.value })} />
            </Field>
            <Field label="E-mail Institucional *">
              <input type="email" autoComplete="off" placeholder="amanda@animaliacash.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
            </Field>
            <Field label="Senha Provisória de Acesso *" hint="Mínimo 10 caracteres, 1 letra maiúscula e 1 caractere especial">
              <input type="password" autoComplete="new-password" placeholder="Ex: Senha@12345" value={form.senha} onChange={(event) => setForm({ ...form, senha: event.target.value })} />
            </Field>
            <div className="field">
              <span className="field-label">Função / Perfil *</span>
              <Segmented label="Função" options={ROLES} value={form.role} onChange={(role) => setForm({ ...form, role })} />
            </div>
            {form.role === 'Veterinário' && (
              <Field label="CRMV * (UF do conselho e número)" hint="Apenas números, até 6 dígitos. Ex: CRMV-SP nº 12345">
                <div className="crmv-row">
                  <select aria-label="UF do CRMV" value={form.crmvUf} onChange={(event) => setForm({ ...form, crmvUf: event.target.value })}>
                    <option value="">UF</option>
                    {UFS.map((uf) => <option key={uf} value={uf}>{uf}</option>)}
                  </select>
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Número do CRMV"
                    placeholder="Ex: 12345"
                    maxLength={6}
                    value={form.crmv}
                    onChange={(event) => setForm({ ...form, crmv: onlyCrmvDigits(event.target.value) })}
                  />
                </div>
              </Field>
            )}
            {formError && <p className="error-text" role="alert">{formError}</p>}
          </div>
        </Modal>
      )}

      {success && (
        <Modal
          title="Colaborador Cadastrado!"
          onClose={() => setSuccess(false)}
          footer={<button type="button" className="btn btn-primary" onClick={() => setSuccess(false)}>Continuar</button>}
        >
          <p>O registro foi efetuado com sucesso e a conta de acesso já está habilitada para realizar o login no sistema.</p>
        </Modal>
      )}
    </>
  );
}
