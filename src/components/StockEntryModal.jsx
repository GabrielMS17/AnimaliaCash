import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { maskDateBR, parseDateBR, registerEntry, daysUntil } from '../services/stockService';
import { formatBRL, formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { PACKAGE_OPTIONS } from './InsumoModal';
import { AppModal, Button, Checkbox, COLORS, ErrorBanner, Field, Input, NumberInput, Select, useAccent, useIsWide } from './ui';

/**
 * Entrada de uma compra no estoque. A compra é informada como vem da nota:
 * ex: 3 caixas com 10 ampolas cada, R$ 45,00 por caixa = 30 ampolas a R$ 4,50.
 */
export default function StockEntryModal({ insumo: initialInsumo, insumos, flushPending, onUpdateInsumo, onClose, onSaved }) {
  const accent = useAccent();
  const isWide = useIsWide(560);
  const [insumoId, setInsumoId] = useState(initialInsumo?.id ?? '');
  const insumo = insumos.find((item) => item.id === insumoId) ?? initialInsumo ?? null;

  const [packageType, setPackageType] = useState(initialInsumo?.packageType ?? 'caixa');
  const [packages, setPackages] = useState(1);
  const [unitsPerPackage, setUnitsPerPackage] = useState(initialInsumo?.packageSize ?? 1);
  const [pricePerPackage, setPricePerPackage] = useState(initialInsumo?.packagePrice ?? 0);
  const [lotNumber, setLotNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [notes, setNotes] = useState('');
  const [updateCost, setUpdateCost] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);

  const chooseInsumo = (id) => {
    const chosen = insumos.find((item) => item.id === id);
    setInsumoId(id);
    setErrorMsg('');
    // Sugere a embalagem que o item já tem cadastrada
    if (chosen?.packageType) setPackageType(chosen.packageType);
    setUnitsPerPackage(chosen?.packageSize ?? 1);
    setPricePerPackage(chosen?.packagePrice ?? 0);
  };

  const unit = insumo?.unit ?? 'un';
  const packageLabel = PACKAGE_OPTIONS.find((option) => option.value === packageType)?.label ?? 'Embalagem';
  const quantity = packages * unitsPerPackage;
  const totalCost = packages * pricePerPackage;
  const unitCost = quantity > 0 ? totalCost / quantity : 0;

  let expiryWarning = '';
  try {
    const iso = parseDateBR(expiry);
    const days = daysUntil(iso);
    if (days !== null && days < 0) expiryWarning = 'Atenção: esta validade já passou. O lote entra no estoque, mas não será usado nos procedimentos.';
  } catch {
    // validação completa acontece ao salvar
  }

  const handleSave = async () => {
    if (!insumo) return setErrorMsg('Escolha o item que está entrando no estoque.');
    if (!(packages > 0)) return setErrorMsg('Informe quantas embalagens foram compradas.');
    if (!(unitsPerPackage > 0)) return setErrorMsg(`Informe quantos ${unit} vêm em cada embalagem.`);
    if (pricePerPackage < 0) return setErrorMsg('Informe o preço pago.');
    let expiresAt;
    try {
      expiresAt = parseDateBR(expiry);
    } catch (error) {
      return setErrorMsg(error.message);
    }

    setSaving(true);
    setErrorMsg('');
    try {
      // O lote aponta para o insumo no banco: envia antes o que ainda estiver pendente
      await flushPending();
      await registerEntry({
        insumoId: insumo.id,
        packages,
        unitsPerPackage,
        totalCost: Number(totalCost.toFixed(2)),
        packageType,
        lotNumber: lotNumber.trim(),
        expiresAt,
        notes: notes.trim(),
      });
      if (updateCost && pricePerPackage > 0) {
        onUpdateInsumo({
          ...insumo,
          packageType,
          packagePrice: pricePerPackage,
          packageSize: unitsPerPackage,
          costPerUnit: pricePerPackage / unitsPerPackage,
        });
      }
      onSaved();
    } catch (error) {
      setErrorMsg(error.message);
      setSaving(false);
    }
  };

  const row = isWide ? styles.row : styles.column;

  return (
    <AppModal
      title="Entrada de compra"
      subtitle="Informe a compra como ela vem na nota: quantas embalagens e quanto vem em cada uma."
      maxWidth={600}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Cancelar" variant="secondary" onPress={onClose} />
          <Button label={saving ? 'Salvando…' : 'Dar entrada'} onPress={handleSave} disabled={saving} />
        </View>
      }
    >
      <ErrorBanner message={errorMsg} />

      <Field label="Item">
        {initialInsumo ? (
          <Text style={styles.itemName}>{initialInsumo.name}</Text>
        ) : (
          <Select
            value={insumoId}
            placeholder="Escolha o item"
            options={[...insumos]
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((item) => ({ value: item.id, label: `${item.name} (${item.unit})` }))}
            onChange={chooseInsumo}
          />
        )}
      </Field>

      <View style={row}>
        <Field label="Embalagem" style={isWide ? styles.fieldWide : undefined}>
          <Select value={packageType} options={PACKAGE_OPTIONS} onChange={setPackageType} />
        </Field>
        <Field label="Quantidade de embalagens" style={isWide ? styles.fieldWide : undefined}>
          <NumberInput min={0} placeholder="Ex: 3" value={packages} onChange={setPackages} />
        </Field>
      </View>

      <View style={row}>
        <Field
          label={`Quanto vem em cada ${packageLabel.toLowerCase()}`}
          hint={`Na unidade usada nos procedimentos (ex: caixa com 10 ampolas = 10 ${unit}).`}
          style={isWide ? styles.fieldWide : undefined}
        >
          <NumberInput min={0} placeholder="Ex: 10" value={unitsPerPackage} onChange={setUnitsPerPackage} suffix={unit} />
        </Field>
        <Field label={`Preço por ${packageLabel.toLowerCase()}`} style={isWide ? styles.fieldWide : undefined}>
          <NumberInput prefix="R$" min={0} placeholder="0,00" value={pricePerPackage} onChange={setPricePerPackage} />
        </Field>
      </View>

      <View style={[styles.totalBox, { backgroundColor: accent.soft }]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.totalLabel}>Entra no estoque</Text>
          <Text style={styles.totalFormula}>
            {formatDecimal(packages, 3)} × {formatDecimal(unitsPerPackage, 3)} {unit} · total {formatBRL(totalCost)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.totalValue}>{formatDecimal(quantity, 3)} {unit}</Text>
          <Text style={styles.totalFormula}>{unitCost > 0 ? `${formatUnitCost(unitCost)} / ${unit}` : '—'}</Text>
        </View>
      </View>

      <View style={row}>
        <Field label="Número do lote (opcional)" style={isWide ? styles.fieldWide : undefined}>
          <Input placeholder="Ex: L2026-045" value={lotNumber} onChangeText={setLotNumber} autoCapitalize="characters" />
        </Field>
        <Field label="Validade (opcional)" style={isWide ? styles.fieldWide : undefined}>
          <Input
            placeholder="DD/MM/AAAA"
            value={expiry}
            onChangeText={(text) => {
              setExpiry(maskDateBR(text));
              setErrorMsg('');
            }}
            keyboardType="number-pad"
            inputMode="numeric"
            maxLength={10}
          />
        </Field>
      </View>
      {expiryWarning ? <Text style={styles.warning}>{expiryWarning}</Text> : null}

      <Field label="Observação (opcional)">
        <Input placeholder="Ex: Nota fiscal 1234, fornecedor X" value={notes} onChangeText={setNotes} />
      </Field>

      <Checkbox
        checked={updateCost}
        onChange={setUpdateCost}
        label="Atualizar o custo do item com o preço desta compra (recalcula os procedimentos)"
      />
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  row: { flexDirection: 'row', gap: 14 },
  column: { gap: 14 },
  fieldWide: { flex: 1 },
  itemName: { fontSize: 15, fontWeight: '700', color: COLORS.text },
  totalBox: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  totalLabel: { fontSize: 13, color: COLORS.textSoft },
  totalFormula: { fontSize: 12, color: COLORS.muted, marginTop: 2 },
  totalValue: { fontSize: 17, fontWeight: '700', color: COLORS.text },
  warning: { fontSize: 12, color: COLORS.warning },
});
