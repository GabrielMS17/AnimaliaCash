import { createContext, useContext, useState } from 'react';
import {
  Alert,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

export const COLORS = {
  navy: '#0C2D48',
  green: '#00A86B',
  bg: '#F8FAFC',
  card: '#FFFFFF',
  border: '#E2E8F0',
  borderStrong: '#CBD5E1',
  text: '#0F172A',
  textSoft: '#334155',
  muted: '#64748B',
  faint: '#94A3B8',
  danger: '#E11D48',
  dangerSoft: '#FFF1F2',
  warning: '#B45309',
};

/** Cada seção tem sua cor de destaque, aplicada a botões, abas e filtros ativos. */
export const SECTIONS = {
  banho_tosa: { label: 'Banho & Tosa', href: '/banho-tosa', accent: '#0284C7', soft: '#E0F2FE' },
  cirurgia: { label: 'Cirurgias', href: '/cirurgia', accent: '#E11D48', soft: '#FFE4E6' },
  internacao: { label: 'Internação', href: '/internacao', accent: '#D97706', soft: '#FEF3C7' },
  insumos: { label: 'Insumos', href: '/insumos', accent: '#7C3AED', soft: '#EDE9FE' },
  configuracoes: { label: 'Configurações', href: '/configuracoes', accent: '#0C2D48', soft: '#E2E8F0' },
};

export const CATEGORY_DOT = {
  banho_tosa: '#0EA5E9',
  cirurgia: '#F43F5E',
  internacao: '#F59E0B',
  geral: '#94A3B8',
};

const AccentContext = createContext(SECTIONS.configuracoes);
export const AccentProvider = AccentContext.Provider;
export const useAccent = () => useContext(AccentContext);

export function useIsWide(breakpoint = 768) {
  const { width } = useWindowDimensions();
  return width >= breakpoint;
}

/** Aviso que funciona na web (window.alert) e no celular (Alert); o Alert do React Native não aparece na web. */
export function notify(title, message) {
  if (Platform.OS === 'web') window.alert(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Confirmação que funciona na web (window.confirm) e no celular (Alert). */
export function confirmAction(message, confirmLabel = 'Confirmar') {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    Alert.alert('Confirmação', message, [
      { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]);
  });
}

export function Button({ label, onPress, variant = 'primary', disabled, small, style }) {
  const accent = useAccent();
  const variants = {
    primary: { backgroundColor: accent.accent, borderColor: accent.accent },
    secondary: { backgroundColor: COLORS.card, borderColor: COLORS.borderStrong },
    danger: { backgroundColor: COLORS.card, borderColor: '#FECDD3' },
    ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  };
  const textColors = {
    primary: '#FFFFFF',
    secondary: COLORS.textSoft,
    danger: COLORS.danger,
    ghost: accent.accent,
  };

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        variants[variant],
        (pressed || disabled) && { opacity: disabled ? 0.45 : 0.8 },
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: textColors[variant] }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, hint, children, style }) {
  return (
    <View style={[styles.field, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      {children}
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

export function Input({ style, ...props }) {
  return <TextInput placeholderTextColor={COLORS.faint} style={[styles.input, style]} {...props} />;
}

function parseDraft(value) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized || normalized === '-' || normalized.endsWith('.')) return null;
  if (!/^-?(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const toDraft = (value) => (value === undefined || value === null ? '' : String(value).replace('.', ','));

/** Campo numérico que aceita vírgula e mantém o texto digitado enquanto está em foco. */
export function NumberInput({ value, onChange, min, max, prefix, suffix, placeholder, style }) {
  const [draft, setDraft] = useState(toDraft(value));
  const [focused, setFocused] = useState(false);
  // Fora de foco, mostra sempre o valor atual (que pode mudar por fora, ex: conversão de unidades)
  const shown = focused ? draft : toDraft(value);

  return (
    <View style={[styles.affixWrapper, style]}>
      {prefix ? <Text style={styles.affix}>{prefix}</Text> : null}
      <TextInput
        keyboardType="decimal-pad"
        inputMode="decimal"
        placeholder={placeholder}
        placeholderTextColor={COLORS.faint}
        value={shown}
        onFocus={() => {
          setDraft(toDraft(value));
          setFocused(true);
        }}
        onChangeText={(text) => {
          setDraft(text);
          const parsed = parseDraft(text);
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseDraft(draft);
          let next = parsed ?? (draft.trim() === '' ? 0 : value ?? 0);
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          onChange(next);
          setDraft(toDraft(next));
        }}
        style={styles.affixInput}
      />
      {suffix ? <Text style={styles.affix}>{suffix}</Text> : null}
    </View>
  );
}

/** Lista de opções em um painel (substitui o <select> da web). */
export function Select({ value, options, onChange, placeholder = 'Selecione', style }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  return (
    <>
      <Pressable onPress={() => setOpen(true)} style={[styles.input, styles.select, style]}>
        <Text style={[styles.selectText, !selected && { color: COLORS.faint }]} numberOfLines={1}>
          {selected ? selected.label : placeholder}
        </Text>
        <Text style={styles.selectChevron}>▾</Text>
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <View style={styles.selectPanel}>
            <ScrollView>
              {options.map((option) => (
                <Pressable
                  key={option.value}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={({ pressed }) => [
                    styles.selectOption,
                    (pressed || option.value === value) && { backgroundColor: COLORS.bg },
                  ]}
                >
                  <Text style={[styles.selectText, option.value === value && { fontWeight: '700' }]}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

/** Grupo de botões de filtro/opção, com rolagem horizontal em telas estreitas. */
export function Segmented({ options, value, onChange }) {
  const accent = useAccent();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.segmented}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <Pressable
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[styles.segment, active && { backgroundColor: COLORS.card, borderColor: accent.accent }]}
          >
            <Text style={[styles.segmentText, active && { color: COLORS.text, fontWeight: '700' }]}>{option.label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function Checkbox({ checked, onChange, label }) {
  const accent = useAccent();
  return (
    <Pressable onPress={() => onChange(!checked)} style={styles.checkboxRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.checkbox, checked && { backgroundColor: accent.accent, borderColor: accent.accent }]}>
        {checked ? <Text style={styles.checkboxMark}>✓</Text> : null}
      </View>
      <Text style={styles.checkboxLabel}>{label}</Text>
    </Pressable>
  );
}

export function ErrorBanner({ message }) {
  if (!message) return null;
  return (
    <View style={styles.errorBanner}>
      <Text style={styles.errorText}>{message}</Text>
    </View>
  );
}

export function SectionHeader({ title, description, action }) {
  const isWide = useIsWide(640);
  return (
    <View style={[styles.sectionHeader, isWide && styles.sectionHeaderWide]}>
      <View style={{ flex: isWide ? 1 : undefined }}>
        <Text style={styles.sectionTitle}>{title}</Text>
        {description ? <Text style={styles.sectionDescription}>{description}</Text> : null}
      </View>
      {action}
    </View>
  );
}

export function AppModal({ visible = true, title, subtitle, onClose, footer, children, maxWidth = 720 }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.modalCard, { maxWidth }]}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.modalTitle}>{title}</Text>
              {subtitle ? <Text style={styles.modalSubtitle}>{subtitle}</Text> : null}
            </View>
            <Pressable onPress={onClose} accessibilityLabel="Fechar" style={styles.modalClose}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
          {footer ? <View style={styles.modalFooter}>{footer}</View> : null}
        </View>
      </View>
    </Modal>
  );
}

export const styles = StyleSheet.create({
  button: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 5, paddingHorizontal: 10, borderRadius: 6 },
  buttonText: { fontSize: 14, fontWeight: '600' },
  buttonTextSmall: { fontSize: 12 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: COLORS.textSoft },
  hint: { fontSize: 12, color: COLORS.muted },
  input: {
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.text,
    backgroundColor: COLORS.card,
  },
  affixWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    borderRadius: 8,
    backgroundColor: COLORS.card,
    paddingHorizontal: 12,
  },
  affix: { fontSize: 13, color: COLORS.faint },
  affixInput: { flex: 1, minWidth: 40, paddingVertical: 9, paddingHorizontal: 6, fontSize: 14, color: COLORS.text },
  select: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  selectText: { fontSize: 14, color: COLORS.text, flexShrink: 1 },
  selectChevron: { fontSize: 12, color: COLORS.faint },
  selectPanel: {
    width: '100%',
    maxWidth: 360,
    maxHeight: 420,
    backgroundColor: COLORS.card,
    borderRadius: 12,
    paddingVertical: 6,
  },
  selectOption: { paddingVertical: 11, paddingHorizontal: 16 },
  segmented: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    backgroundColor: '#E2E8F099',
    borderRadius: 10,
  },
  segment: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 7,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  segmentText: { fontSize: 13, color: COLORS.muted, fontWeight: '500' },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.card,
  },
  checkboxMark: { color: '#FFFFFF', fontSize: 12, fontWeight: '800' },
  checkboxLabel: { fontSize: 14, color: COLORS.textSoft, flexShrink: 1 },
  errorBanner: {
    padding: 12,
    borderRadius: 8,
    backgroundColor: COLORS.dangerSoft,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  errorText: { color: '#BE123C', fontSize: 13 },
  sectionHeader: { gap: 12, marginBottom: 16 },
  sectionHeaderWide: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: COLORS.navy },
  sectionDescription: { fontSize: 14, color: COLORS.muted, marginTop: 4 },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '92%',
    backgroundColor: COLORS.card,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: COLORS.text },
  modalSubtitle: { fontSize: 13, color: COLORS.muted, marginTop: 2 },
  modalClose: { padding: 4 },
  modalCloseText: { fontSize: 16, color: COLORS.faint },
  modalBody: { flexGrow: 0, flexShrink: 1 },
  modalBodyContent: { padding: 20, gap: 18 },
  modalFooter: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.bg,
  },
});
