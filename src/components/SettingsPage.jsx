import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { isUsingDefaultSupabase } from '../supabase';
import { formatBRL } from '../utils/costCalculations';
import { Button, Checkbox, COLORS, confirmAction, Field, Input, NumberInput, SectionHeader, useIsWide } from './ui';

export default function SettingsPage() {
  const { settings, saveSettings, resetData } = useAnimaliaData();
  const isWide = useIsWide(640);
  const [form, setForm] = useState(settings);
  const [saved, setSaved] = useState(false);
  const [professionalName, setProfessionalName] = useState('');
  const [professionalSpecialty, setProfessionalSpecialty] = useState('');
  const [professionalCost, setProfessionalCost] = useState(0);
  const [editingProfessionalId, setEditingProfessionalId] = useState(null);

  // Acompanha mudanças vindas de fora do formulário (ex: dados baixados do Supabase)
  const [lastSettings, setLastSettings] = useState(settings);
  if (settings !== lastSettings) {
    setLastSettings(settings);
    setForm(settings);
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

  const saveProfessional = () => {
    const name = professionalName.trim();
    const specialty = professionalSpecialty.trim();
    if (!name || !specialty) return;

    const professional = {
      id: editingProfessionalId ?? `professional_${Date.now()}`,
      name,
      specialty,
      defaultCost: Math.max(0, professionalCost),
    };
    const professionals = form.externalProfessionals ?? [];
    update(
      'externalProfessionals',
      editingProfessionalId
        ? professionals.map((item) => (item.id === editingProfessionalId ? professional : item))
        : [...professionals, professional],
    );
    clearProfessionalForm();
  };

  const isDirty = JSON.stringify(form) !== JSON.stringify(settings);
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
          {(form.externalProfessionals ?? []).map((professional) => (
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
                onPress={() => {
                  update('externalProfessionals', (form.externalProfessionals ?? []).filter((item) => item.id !== professional.id));
                  if (editingProfessionalId === professional.id) clearProfessionalForm();
                }}
              />
            </View>
          ))}
          <View style={row}>
            <Field label="Nome" style={styles.cell}>
              <Input placeholder="Ex: Dra. Ana Silva" value={professionalName} onChangeText={setProfessionalName} />
            </Field>
            <Field label="Especialidade" style={styles.cell}>
              <Input placeholder="Ex: Anestesiologia" value={professionalSpecialty} onChangeText={setProfessionalSpecialty} />
            </Field>
            <Field label="Custo padrão por procedimento" style={styles.cell}>
              <NumberInput prefix="R$" min={0} value={professionalCost} onChange={setProfessionalCost} />
            </Field>
          </View>
          <View style={styles.inline}>
            <Button
              variant="secondary"
              label={editingProfessionalId ? 'Salvar profissional' : '+ Adicionar profissional'}
              disabled={!professionalName.trim() || !professionalSpecialty.trim()}
              onPress={saveProfessional}
            />
            {editingProfessionalId && <Button variant="ghost" label="Cancelar edição" onPress={clearProfessionalForm} />}
          </View>
        </Section>

        <Section title="Comissões padrão" description="Aplicado aos procedimentos sem comissão própria e sugerido ao criar novos.">
          <View style={row}>
            <Field label="Cirurgias" style={styles.cell}>
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionSurgeryPercent ?? 0} onChange={(value) => update('defaultVetCommissionSurgeryPercent', value)} />
            </Field>
            <Field label="Internação" style={styles.cell}>
              <NumberInput suffix="%" min={0} max={100} value={form.defaultVetCommissionInternmentPercent ?? 0} onChange={(value) => update('defaultVetCommissionInternmentPercent', value)} />
            </Field>
            <Field label="Banho & Tosa" style={styles.cell}>
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
              saveSettings({ ...form, clinicName: form.clinicName.trim() });
              setSaved(true);
            }}
          />
        </View>
      </View>

      <SyncCard />

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

function SyncCard() {
  const { session, autoSync, setAutoSync, syncStatus, pushNow, pullNow } = useAnimaliaData();
  const syncing = syncStatus.state === 'syncing';

  return (
    <View style={styles.card}>
      <Section
        title="Sincronização com o Supabase"
        description="Os dados ficam salvos neste navegador/dispositivo. Com login feito, também são enviados para o banco no Supabase."
      >
        {isUsingDefaultSupabase && (
          <Text style={styles.warning}>
            Usando o projeto Supabase padrão do código. Para o ambiente de teste, configure o arquivo .env.local (veja supabase/README.md).
          </Text>
        )}

        {session ? (
          <Text style={styles.muted}>Conectado como <Text style={styles.itemTitle}>{session.user.email}</Text></Text>
        ) : (
          <Text style={styles.muted}>
            Você não está logado.{' '}
            <Link href="/Login" style={styles.link}>Fazer login</Link> para sincronizar.
          </Text>
        )}

        <Checkbox checked={autoSync} onChange={setAutoSync} label="Enviar automaticamente a cada alteração" />

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
  itemTitle: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  row: { flexDirection: 'row', gap: 14 },
  column: { gap: 14 },
  cell: { flex: 1 },
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
