import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expiredLotQuestion, maskDateBR, NON_STOCK_UNITS, parseDateBR } from '../services/stockService';
import { formatBRL, formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { AppModal, Button, Checkbox, COLORS, confirmAction, ErrorBanner, Field, Input, NumberInput, Select, useAccent, useIsWide } from './ui';

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

export default function InsumoModal({ insumo, onClose, onSave, categoryOptions = CATEGORY_OPTIONS }) {
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
  const [brand, setBrand] = useState(insumo?.brand ?? '');
  const [minStock, setMinStock] = useState(insumo?.minStock ?? 0);
  const [entryPackages, setEntryPackages] = useState(1);
  const [entryQuantity, setEntryQuantity] = useState(0);
  const [entryLot, setEntryLot] = useState('');
  const [initialExpiry, setInitialExpiry] = useState('');
  const [saving, setSaving] = useState(false);
  // O mesmo id em uma nova tentativa: se a entrada falhar, salvar de novo não duplica o item
  const [itemId] = useState(() => insumo?.id ?? `ins_${Date.now()}`);
  // Sem escolha do usuário, segue a unidade: kWh, minuto, hora e diária não têm estoque
  const [trackChoice, setTrackChoice] = useState(insumo?.trackStock);
  const autoTrack = !NON_STOCK_UNITS.includes(unit);
  const trackStock = trackChoice ?? autoTrack;
  const [errorMsg, setErrorMsg] = useState('');

  const packageLabel = PACKAGE_OPTIONS.find((option) => option.value === packageType)?.label.toLowerCase() ?? 'embalagem';
  const isMasculine = MASCULINE_PACKAGES.includes(packageType);
  const ofThe = isMasculine ? 'do' : 'da';
  const inThe = isMasculine ? 'no' : 'na';
  const costPerUnit = directCost ? manualCost : packagePrice > 0 && packageSize > 0 ? packagePrice / packageSize : 0;
  // Primeira entrada (só no cadastro): em embalagens ou, no custo direto, na própria unidade
  const entryUnits = directCost ? entryQuantity : entryPackages * packageSize;
  const entryTotal = directCost ? entryQuantity * manualCost : entryPackages * packagePrice;

  const handleSave = async () => {
    // 1. Sanitização e Validação do Nome (Proteção contra strings vazias ou excessivas)
    const sanitizedName = name.trim();
    if (!sanitizedName) {
      return setErrorMsg('Informe o nome do insumo.');
    }
    if (sanitizedName.length > 100) {
      return setErrorMsg('O nome do insumo é muito longo (máximo de 100 caracteres).');
    }

    // 2. Validação baseada no tipo de custo (Direto vs Embalagem)
    if (!directCost) {
      const parsedPrice = Number(packagePrice);
      const parsedSize = Number(packageSize);

      if (isNaN(parsedPrice) || parsedPrice <= 0) {
        return setErrorMsg(`Informe um preço válido ${isMasculine ? 'pelo' : 'pela'} ${packageLabel}.`);
      }
      if (isNaN(parsedSize) || parsedSize <= 0) {
        return setErrorMsg(`Informe uma quantidade válida que vem ${inThe} ${packageLabel}.`);
      }
    } else {
      const parsedManualCost = Number(manualCost);
      if (isNaN(parsedManualCost) || parsedManualCost <= 0) {
        return setErrorMsg('O custo unitário direto deve ser maior que zero.');
      }
    }

    // 3. Sanitização das Observações (Opcional, mas seguro)
    const sanitizedNotes = notes.trim();
    if (sanitizedNotes.length > 255) {
      return setErrorMsg('As observações devem ter no máximo 255 caracteres.');
    }
    const sanitizedBrand = brand.trim();
    if (sanitizedBrand.length > 80) {
      return setErrorMsg('A marca deve ter no máximo 80 caracteres.');
    }

    // Item novo pode já entrar com estoque
    let initialEntry = null;
    if (!isEditing && trackStock && entryUnits > 0) {
      let expiresAt;
      try {
        expiresAt = parseDateBR(initialExpiry);
      } catch (parseError) {
        return setErrorMsg(parseError.message);
      }
      const question = expiredLotQuestion(expiresAt, `${formatDecimal(entryUnits, 3)} ${unit}`);
      if (question && !(await confirmAction(question, 'Salvar mesmo assim'))) return undefined;
      initialEntry = {
        packages: directCost ? entryQuantity : entryPackages,
        unitsPerPackage: directCost ? 1 : packageSize,
        packageType: directCost ? 'unidade' : packageType,
        totalCost: Number(entryTotal.toFixed(2)),
        lotNumber: entryLot.trim(),
        expiresAt,
      };
    }

    // 4. Envio seguro com dados validados
    setSaving(true);
    setErrorMsg('');
    try {
      await onSave({
        id: itemId,
        name: sanitizedName,
        category,
        unit,
        costPerUnit,
        packageType: directCost ? undefined : packageType,
        packagePrice: directCost ? undefined : Number(packagePrice),
        packageSize: directCost ? undefined : Number(packageSize),
        notes: sanitizedNotes || undefined,
        brand: sanitizedBrand || undefined,
        minStock: trackStock && minStock > 0 ? minStock : undefined,
        trackStock: trackStock === autoTrack ? undefined : trackStock,
      }, initialEntry);
    } catch (error) {
      setErrorMsg(error.message);
      setSaving(false);
    }
    return undefined;
  };

  const row = isWide ? styles.row : styles.column;

  return (
    <AppModal
      title={isEditing ? 'Editar item do estoque' : 'Novo item do estoque'}
      subtitle={isEditing
        ? 'Alterações no custo refletem em todos os procedimentos que usam este item.'
        : 'Cadastro e primeira compra juntos: o item já entra com saldo, lote e validade.'}
      maxWidth={560}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={saving ? 'Salvando…' : isEditing || !trackStock || !(entryUnits > 0) ? 'Salvar' : 'Cadastrar e dar entrada'} onPress={handleSave} disabled={saving} />
        </View>
      }
    >
      <ErrorBanner message={errorMsg} />

      <View style={row}>
        <Field label="Nome" style={isWide ? styles.nameFieldWide : undefined}>
          <Input
            placeholder="Ex: Luvas cirúrgicas estéreis"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setErrorMsg('');
            }}
          />
        </Field>
        <Field label="Categoria" style={isWide ? styles.fieldWide : undefined}>
          <Select value={category} options={categoryOptions} onChange={setCategory} />
        </Field>
      </View>

      {!directCost ? (
        <View style={styles.group}>
          <Text style={styles.groupTitle}>Como você compra</Text>
          <View style={row}>
            <Field label="Embalagem" style={isWide ? styles.fieldWide : undefined}>
              <Select value={packageType} options={PACKAGE_OPTIONS} onChange={setPackageType} />
            </Field>
            <Field label={`Preço ${ofThe} ${packageLabel}`} style={isWide ? styles.fieldWide : undefined}>
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

      <View style={styles.group}>
        <Text style={styles.groupTitle}>Estoque</Text>
        <Checkbox
          checked={trackStock}
          onChange={setTrackChoice}
          label="Controlar o estoque deste item (desmarque para energia, água da torneira, tempo...)"
        />
        {trackStock && !isEditing && (
          <>
            <View style={row}>
              {directCost ? (
                <Field label="Quantidade que está entrando" hint="Deixe 0 para só cadastrar o item." style={isWide ? styles.fieldWide : undefined}>
                  <NumberInput min={0} placeholder="0" value={entryQuantity} onChange={setEntryQuantity} suffix={unit} />
                </Field>
              ) : (
                <Field label="Embalagens entrando" hint="Deixe 0 para só cadastrar o item." style={isWide ? styles.fieldWide : undefined}>
                  <NumberInput min={0} placeholder="Ex: 3" value={entryPackages} onChange={setEntryPackages} />
                </Field>
              )}
              <Field label="Número do lote (opcional)" style={isWide ? styles.fieldWide : undefined}>
                <Input placeholder="Ex: L2026-045" value={entryLot} onChangeText={setEntryLot} autoCapitalize="characters" />
              </Field>
              <Field label="Validade (opcional)" style={isWide ? styles.fieldWide : undefined}>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={initialExpiry}
                  onChangeText={(text) => {
                    setInitialExpiry(maskDateBR(text));
                    setErrorMsg('');
                  }}
                  keyboardType="number-pad"
                  inputMode="numeric"
                  maxLength={10}
                />
              </Field>
            </View>
            <View style={[styles.costBox, { backgroundColor: accent.soft }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.costLabel}>Entra no estoque</Text>
                <Text style={styles.costFormula}>
                  {directCost ? '' : `${formatDecimal(entryPackages, 3)} × ${formatDecimal(packageSize, 3)} ${unit} · `}total {formatBRL(entryTotal)}
                </Text>
              </View>
              <Text style={styles.costValue}>{formatDecimal(entryUnits, 3)} {unit}</Text>
            </View>
          </>
        )}
        {trackStock && isEditing && (
          <Text style={styles.muted}>Para somar quantidade, use o botão “Entrada” do item. Para corrigir um lote, use “Lotes”.</Text>
        )}
        {trackStock && (
          <Field label="Estoque mínimo (opcional)" hint="Abaixo deste saldo o item aparece com alerta de reposição.">
            <NumberInput min={0} placeholder="0" value={minStock} onChange={setMinStock} suffix={unit} style={{ width: 170 }} />
          </Field>
        )}
      </View>

      <Field label="Marca / fabricante (opcional)">
        <Input placeholder="Ex: Zoetis, Ourofino" value={brand} onChangeText={setBrand} />
      </Field>

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
  nameFieldWide: { flex: 2 },
  fieldWide: { flex: 1 },
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
