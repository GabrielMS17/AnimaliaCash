import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatBRL, formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { AppModal, Button, Checkbox, COLORS, ErrorBanner, Field, Input, NumberInput, Select, useAccent, useIsWide } from './ui';

export const UNIT_OPTIONS = [
  { value: 'un', label: 'Unidade (un)' },
  { value: 'ml', label: 'Mililitro (ml)' },
  { value: 'l', label: 'Litro (l)' },
  { value: 'g', label: 'Grama (g)' },
  { value: 'kg', label: 'Quilo (kg)' },
  { value: 'par', label: 'Par' },
  { value: 'm', label: 'Metro (m)' },
  { value: 'dose', label: 'Dose' },
  { value: 'diaria', label: 'Diária' },
  { value: 'hora', label: 'Hora' },
  { value: 'min', label: 'Minuto' },
  { value: 'kwh', label: 'kWh' },
];

export const PACKAGE_OPTIONS = [
  { value: 'caixa', label: 'Caixa' },
  { value: 'pacote', label: 'Pacote' },
  { value: 'frasco', label: 'Frasco' },
  { value: 'galao', label: 'Galão' },
  { value: 'ampola', label: 'Ampola' },
  { value: 'bolsa', label: 'Bolsa' },
  { value: 'rolo', label: 'Rolo' },
  { value: 'fardo', label: 'Fardo' },
  { value: 'kit', label: 'Kit' },
  { value: 'unidade', label: 'Unidade avulsa' },
];

export const CATEGORY_OPTIONS = [
  { value: 'cirurgia', label: 'Cirurgia' },
  { value: 'internacao', label: 'Internação' },
  { value: 'banho_tosa', label: 'Banho & Tosa' },
  { value: 'geral', label: 'Geral' },
];

const MASCULINE_PACKAGES = ['pacote', 'frasco', 'galao', 'rolo', 'fardo', 'kit'];

/** Ex: "Caixa com 20 par · R$ 90,00". Retorna null se o insumo não tem embalagem cadastrada. */
export function describePackage(insumo) {
  if (!insumo.packagePrice || !insumo.packageSize) return null;
  const type = PACKAGE_OPTIONS.find((option) => option.value === insumo.packageType)?.label ?? 'Embalagem';
  return `${type} com ${formatDecimal(insumo.packageSize, 3)} ${insumo.unit} · ${formatBRL(insumo.packagePrice)}`;
}

export default function InsumoModal({ insumo, onClose, onSave }) {
  const accent = useAccent();
  const isWide = useIsWide(560);
  const isEditing = Boolean(insumo);
  const hasPackage = Boolean(insumo?.packagePrice && insumo?.packageSize);

  const [name, setName] = useState(insumo?.name ?? '');
  const [category, setCategory] = useState(insumo?.category ?? 'geral');
  const [unit, setUnit] = useState(insumo?.unit ?? 'un');
  // Novo insumo começa pela compra em embalagem; existente sem embalagem abre no custo direto
  const [directCost, setDirectCost] = useState(isEditing && !hasPackage);
  const [packageType, setPackageType] = useState(insumo?.packageType ?? 'caixa');
  const [packagePrice, setPackagePrice] = useState(insumo?.packagePrice ?? 0);
  const [packageSize, setPackageSize] = useState(insumo?.packageSize ?? 0);
  const [manualCost, setManualCost] = useState(insumo?.costPerUnit ?? 0);
  const [notes, setNotes] = useState(insumo?.notes ?? '');
  const [errorMsg, setErrorMsg] = useState('');

  const packageLabel = PACKAGE_OPTIONS.find((option) => option.value === packageType)?.label.toLowerCase() ?? 'embalagem';
  const isMasculine = MASCULINE_PACKAGES.includes(packageType);
  const ofThe = isMasculine ? 'do' : 'da';
  const inThe = isMasculine ? 'no' : 'na';
  const costPerUnit = directCost ? manualCost : packagePrice > 0 && packageSize > 0 ? packagePrice / packageSize : 0;

  const handleSave = () => {
    if (!name.trim()) return setErrorMsg('Informe o nome do insumo.');
    if (!directCost) {
      if (packagePrice <= 0) return setErrorMsg(`Informe o preço pago ${isMasculine ? 'pelo' : 'pela'} ${packageLabel}.`);
      if (packageSize <= 0) return setErrorMsg(`Informe a quantidade que vem ${inThe} ${packageLabel}.`);
    } else if (manualCost <= 0) {
      return setErrorMsg('O custo unitário deve ser maior que zero.');
    }

    onSave({
      id: insumo?.id ?? `ins_${Date.now()}`,
      name: name.trim(),
      category,
      unit,
      costPerUnit,
      packageType: directCost ? undefined : packageType,
      packagePrice: directCost ? undefined : packagePrice,
      packageSize: directCost ? undefined : packageSize,
      notes: notes.trim() || undefined,
    });
  };

  const row = isWide ? styles.row : styles.column;

  return (
    <AppModal
      title={isEditing ? 'Editar insumo' : 'Novo insumo'}
      subtitle="Alterações no custo refletem em todos os procedimentos que usam este item."
      maxWidth={560}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label="Salvar" onPress={handleSave} />
        </View>
      }
    >
      <ErrorBanner message={errorMsg} />

      <View style={row}>
        <Field label="Nome" style={{ flex: 2 }}>
          <Input
            placeholder="Ex: Luvas cirúrgicas estéreis"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrorMsg('');
            }}
          />
        </Field>
        <Field label="Categoria" style={{ flex: 1 }}>
          <Select value={category} options={CATEGORY_OPTIONS} onChange={setCategory} />
        </Field>
      </View>

      {!directCost ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Como você compra</Text>
          <View style={row}>
            <Field label="Embalagem" style={{ flex: 1 }}>
              <Select value={packageType} options={PACKAGE_OPTIONS} onChange={setPackageType} />
            </Field>
            <Field label={`Preço ${ofThe} ${packageLabel}`} style={{ flex: 1 }}>
              <NumberInput
                prefix="R$"
                min={0}
                placeholder="0,00"
                value={packagePrice}
                onChange={(value) => {
                  setPackagePrice(value);
                  setErrorMsg('');
                }}
              />
            </Field>
          </View>
          <Field
            label={`Quantidade ${inThe} ${packageLabel}`}
            hint="Use a unidade em que o item é gasto nos procedimentos (ex: caixa de luvas = 50 par; frasco de shampoo = 5000 ml)."
          >
            <View style={styles.inline}>
              <NumberInput
                min={0}
                placeholder="Ex: 20"
                value={packageSize}
                onChange={(value) => {
                  setPackageSize(value);
                  setErrorMsg('');
                }}
                style={{ width: 110 }}
              />
              <Select value={unit} options={UNIT_OPTIONS} onChange={setUnit} style={{ minWidth: 150 }} />
            </View>
          </Field>

          <View style={[styles.costBox, { backgroundColor: accent.soft }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.costLabel}>Custo unitário</Text>
              {costPerUnit > 0 ? (
                <Text style={styles.costFormula}>
                  {formatBRL(packagePrice)} ÷ {formatDecimal(packageSize, 3)} {unit}
                </Text>
              ) : null}
            </View>
            <Text style={styles.costValue}>{costPerUnit > 0 ? `${formatUnitCost(costPerUnit)} / ${unit}` : '—'}</Text>
          </View>
        </View>
      ) : (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Custo unitário</Text>
          <View style={styles.inline}>
            <NumberInput
              prefix="R$"
              min={0}
              value={manualCost}
              onChange={(value) => {
                setManualCost(value);
                setErrorMsg('');
              }}
              style={{ width: 150 }}
            />
            <Text style={styles.muted}>por</Text>
            <Select value={unit} options={UNIT_OPTIONS} onChange={setUnit} style={{ minWidth: 150 }} />
          </View>
        </View>
      )}

      <Checkbox
        checked={directCost}
        onChange={(checked) => {
          // Ao trocar para custo direto, parte do valor que a embalagem calculava
          if (checked && costPerUnit > 0) setManualCost(Number(costPerUnit.toFixed(4)));
          setDirectCost(checked);
          setErrorMsg('');
        }}
        label="Informar custo unitário direto (sem embalagem, ex: kWh, diária)"
      />

      <Field label="Observações (opcional)">
        <Input placeholder="Ex: Lâmina nº 15 estéril" value={notes} onChangeText={setNotes} />
      </Field>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  row: { flexDirection: 'row', gap: 14 },
  column: { gap: 14 },
  group: { gap: 14 },
  groupTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  muted: { fontSize: 13, color: COLORS.muted },
  costBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  costLabel: { fontSize: 13, color: COLORS.textSoft },
  costFormula: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  costValue: { fontSize: 17, fontWeight: '700', color: COLORS.text },
});
