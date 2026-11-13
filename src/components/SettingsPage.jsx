import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { supabase } from '../supabase';
import { formatBRL } from '../utils/costCalculations';
import { Button, Checkbox, COLORS, confirmAction, Field, Input, NumberInput, SectionHeader, useIsWide } from './ui';

const withoutProfessionals = ({ externalProfessionals, ...rest }) => rest;
const sameFields = (a, b) => JSON.stringify(withoutProfessionals(a)) === JSON.stringify(withoutProfessionals(b));

export default function SettingsPage() {
  const { settings, procedures, saveSettings, saveProfessional, deleteProfessional, resetData } = useAnimaliaData();
  const isWide = useIsWide(640);
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [professionalName, setProfessionalName] = useState('');
  const [professionalSpecialty, setProfessionalSpecialty] = useState('');
  const [professionalCost, setProfessionalCost] = useState(0);
  const [editingProfessionalId, setEditingProfessionalId] = useState(null);
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

  const clearProfessionalForm = () => {
    setEditingProfessionalId(null);
    setProfessionalName('');
    setProfessionalSpecialty('');
    setProfessionalCost(0);
  };

  const submitProfessional = () => {
    const name = professionalName.trim();
    const specialty = professionalSpecialty.trim();
    if (!name || !specialty) return;

    const professional = {
      id: editingProfessionalId ?? `professional_${Date.now()}`,
      name,
      specialty,
      defaultCost: Math.max(0, professionalCost),
    };
    saveProfessional(professional);
    clearProfessionalForm();
    setProfessionalMessage(editingProfessionalId ? '✓ Profissional atualizado.' : '✓ Profissional cadastrado.');
  };

  const removeProfessional = async (professional) => {
    const count = procedures.filter((procedure) =>
      (procedure.externalProfessionalAssignments ?? []).some((item) => item.professionalId === professional.id)).length;
    const message = count > 0
      ? `${professional.name} está em ${count} procedimento(s) e será removido deles, reduzindo o custo. Deseja excluir?`
      : `Deseja excluir ${professional.name}?`;
    if (!(await confirmAction(message, 'Excluir'))) return;
    deleteProfessional(professional.id);
    if (editingProfessionalId === professional.id) clearProfessionalForm();
    setProfessionalMessage('✓ Profissional excluído.');
  };

  const isDirty = !sameFields(form, settings);
  const row = isWide ? styles.row : styles.column;

  return (
    <View style={styles.page}>
      <SectionHeader title="Configurações" description="Valores padrão usados no cálculo de todos os procedimentos." />

      <View style={styles.card}>
        <Section title="Clínica">
          <Field label="Nome da clínica">
            <Input value={form.clinicName} onChangeText={(text) => update('clinicName', text)} />
          </Field>
        </Section>

        <Section title="Profissionais terceirizados" description="Cadastre anestesistas, especialistas e seus valores padrão por procedimento.">
          {(settings.externalProfessionals ?? []).map((professional) => (
            <View key={professional.id} style={styles.listRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{professional.name}</Text>
                <Text style={styles.muted}>{professional.specialty} · {formatBRL(professional.defaultCost)} por procedimento</Text>
              </View>
              <Button
                small
                variant="secondary"
                label="Editar"
                onPress={() => {
                  setEditingProfessionalId(professional.id);
                  setProfessionalName(professional.name);
                  setProfessionalSpecialty(professional.specialty);
                  setProfessionalCost(professional.defaultCost);
                }}
              />
              <Button
                small
                variant="danger"
                label="Excluir"
                onPress={() => removeProfessional(professional)}
              />
            </View>
          ))}
          <View style={row}>
            <Field label="Nome" style={[styles.cell, isWide && styles.cellWide]}>
              <Input placeholder="Ex: Dra. Ana Silva" value={professionalName} onChangeText={setProfessionalName} />
            </Field>
            <Field label="Especialidade" style={[styles.cell, isWide && styles.cellWide]}>
              <Input placeholder="Ex: Anestesiologia" value={professionalSpecialty} onChangeText={setProfessionalSpecialty} />
            </Field>
            <Field label="Custo padrão por procedimento" style={[styles.cell, isWide && styles.cellWide]}>
              <NumberInput prefix="R$" min={0} value={professionalCost} onChange={setProfessionalCost} />
            </Field>
          </View>
          <View style={styles.inline}>
            <Button
              variant="secondary"
              label={editingProfessionalId ? 'Salvar profissional' : '+ Adicionar profissional'}
              disabled={!professionalName.trim() || !professionalSpecialty.trim()}
              onPress={submitProfessional}
            />
            {editingProfessionalId && <Button variant="ghost" label="Cancelar edição" onPress={clearProfessionalForm} />}
            {professionalMessage ? <Text style={styles.savedText}>{professionalMessage}</Text> : null}
          </View>
        </Section>

        <Section title="Comissões padrão" description="Para os profissionais da clínica, aplicado aos procedimentos sem comissão própria. Terceirizados não recebem comissão e o custo deles fica fora do cálculo: a base é o preço menos esse custo ou, sem preço, os insumos mais o custo operacional.">
          <View style={row}>
            <Field label="Cirurgias" style={[styles.cell, isWide && styles.cellWide]}>
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionSurgeryPercent ?? 0} onChange={(value) => update('defaultVetCommissionSurgeryPercent', value)} />
            </Field>
            <Field label="Internação" style={[styles.cell, isWide && styles.cellWide]}>
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionInternmentPercent ?? 0} onChange={(value) => update('defaultVetCommissionInternmentPercent', value)} />
            </Field>
            <Field label="Banho & Tosa" style={[styles.cell, isWide && styles.cellWide]}>
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionBathPercent ?? 0} onChange={(value) => update('defaultVetCommissionBathPercent', value)} />
            </Field>
          </View>
        </Section>

        <View style={styles.saveBar}>
          {saved && !isDirty && <Text style={styles.savedText}>✓ Salvo</Text>}
          <Button
            label="Salvar configurações"
            disabled={!isDirty}
            onPress={() => {
              const clinicName = form.clinicName.trim();
              saveSettings({ ...settings, ...withoutProfessionals(form), clinicName });
              setForm((prev) => ({ ...prev, clinicName }));
              setSaved(true);
            }}
          />
        </View>
      </View>

      <SyncCard />
      <ChangePasswordCard />

      <View style={[styles.card, styles.resetCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>Restaurar dados de exemplo</Text>
          <Text style={styles.muted}>Substitui todos os procedimentos e insumos pelos dados iniciais. As configurações acima são mantidas.</Text>
        </View>
        <Button
          variant="danger"
          label="Restaurar"
          onPress={async () => {
            if (await confirmAction('Substituir todos os procedimentos e insumos pelos dados de exemplo? As alterações feitas serão perdidas.', 'Restaurar')) {
              resetData();
            }
          }}
        />
      </View>
    </View>
  );
}

function ChangePasswordCard() {
  const { session } = useAnimaliaData();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  if (!session) return null;

  const handleUpdatePassword = async () => {
    setMessage(null);
    setError(null);

    if (!currentPassword || !newPassword || !confirmPassword) {
      setError('Preencha todos os campos de senha.');
      return;
    }

    if (newPassword.length < 10) {
      setError('A nova senha deve conter no mínimo 10 caracteres.');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      setError('A nova senha deve conter pelo menos uma letra maiúscula.');
      return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      setError('A nova senha deve conter pelo menos um caractere especial.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('A nova senha e a confirmação não coincidem.');
      return;
    }

    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: session.user.email,
        password: currentPassword,
      });

      if (signInError) {
        throw new Error('A senha atual está incorreta.');
      }

      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (updateError) throw updateError;

      setMessage('Senha alterada com sucesso!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.message || 'Erro ao alterar a senha.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.card}>
      <Section
        title="Alterar senha"
        description="Atualize sua senha de acesso ao sistema informando a senha atual e a nova senha."
      >
        <Field label="Senha atual">
          <Input
            secureTextEntry
            placeholder="Digite sua senha atual"
            value={currentPassword}
            onChangeText={setCurrentPassword}
          />
        </Field>

        <Field label="Nova senha">
          <Text style={styles.inputSubLabel}>Mínimo 10 caracteres, 1 letra maiúscula e 1 caractere especial</Text>
          <Input
            secureTextEntry
            placeholder="Ex: Senha@12345"
            value={newPassword}
            onChangeText={setNewPassword}
          />
        </Field>

        <Field label="Confirmar nova senha">
          <Input
            secureTextEntry
            placeholder="Digite novamente a nova senha"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
          />
        </Field>

        <View style={styles.inline}>
          <Button
            label={loading ? 'Alterando…' : 'Atualizar senha'}
            disabled={loading}
            onPress={handleUpdatePassword}
          />
        </View>

        {message && <Text style={styles.savedText}>✓ {message}</Text>}
        {error && <Text style={styles.errorText}>{error}</Text>}
      </Section>
    </View>
  );
}

function SyncCard() {
  const { session, autoSync, setAutoSync, syncStatus, pushNow, pullNow } = useAnimaliaData();
  const syncing = syncStatus.state === 'syncing';

  return (
    <View style={styles.card}>
      <Section
        title="Sincronização com o Supabase"
        description="Com login feito, os dados da clínica são enviados para o banco e atualizados com o que outros usuários gravarem."
      >
        {session ? (
          <Text style={styles.muted}>Conectado como <Text style={styles.itemTitle}>{session.user.email}</Text></Text>
        ) : (
          <Text style={styles.muted}>
            Você não está logado.{' '}
            <Link href="/Login" style={styles.link}>Fazer login</Link> para sincronizar.
          </Text>
        )}

        <Checkbox checked={autoSync} onChange={setAutoSync} label="Sincronizar automaticamente" />

        <View style={styles.inline}>
          <Button label={syncing ? 'Sincronizando…' : 'Enviar dados agora'} disabled={!session || syncing} onPress={pushNow} />
          <Button
            variant="secondary"
            label="Baixar do Supabase"
            disabled={!session || syncing}
            onPress={async () => {
              if (await confirmAction('Substituir os dados deste dispositivo pelos dados salvos no Supabase?', 'Baixar')) pullNow();
            }}
          />
        </View>

        {syncStatus.state === 'ok' && (
          <Text style={styles.savedText}>✓ {syncStatus.message} ({syncStatus.at.toLocaleTimeString('pt-BR')})</Text>
        )}
        {syncStatus.state === 'empty' && <Text style={styles.warning}>{syncStatus.message}</Text>}
        {syncStatus.state === 'error' && <Text style={styles.errorText}>{syncStatus.message}</Text>}
      </Section>
    </View>
  );
}

function Section({ title, description, children }) {
  return (
    <View style={styles.section}>
      <View>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.muted}>{description}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 20, maxWidth: 760 },
  card: { backgroundColor: COLORS.card, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border },
  section: { padding: 20, gap: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 2 },
  muted: { fontSize: 13, color: COLORS.muted },
  inputSubLabel: { fontSize: 10, color: '#64748B', marginBottom: 6 },
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  row: { flexDirection: 'row', gap: 14 },
  column: { gap: 14 },
  cell: { minWidth: 0 },
  cellWide: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  saveBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 12,
    padding: 16,
    backgroundColor: COLORS.bg,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
  savedText: { fontSize: 13, color: '#047857' },
  errorText: { fontSize: 13, color: COLORS.danger },
  warning: { fontSize: 13, color: COLORS.warning },
  link: { color: '#2563EB', fontWeight: '600' },
  resetCard: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, flexWrap: 'wrap' },
});