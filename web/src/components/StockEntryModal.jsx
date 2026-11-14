import { useState } from 'react';
import { daysUntil, maskDateBR, parseDateBR, registerEntry } from '../services/stockService';
import { formatBRL, formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { PACKAGE_OPTIONS } from './InsumoModal';
import { Field, Modal, NumberInput } from './ui';

/**
 * Entrada de uma compra no estoque. A compra é informada como vem da nota:
 * ex: 3 caixas com 10 ampolas cada, R$ 45,00 por caixa = 30 ampolas a R$ 4,50.
 */
export default function StockEntryModal({ insumo: initialInsumo, insumos, flushPending, onUpdateInsumo, onClose, onSaved }) {
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
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const chooseInsumo = (id) => {
    const chosen = insumos.find((item) => item.id === id);
    setInsumoId(id);
    setError('');
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
    const days = daysUntil(parseDateBR(expiry));
    if (days !== null && days < 0) expiryWarning = 'Atenção: esta validade já passou. O lote entra no estoque, mas não será usado nos procedimentos.';
  } catch {
    // a validação completa acontece ao salvar
  }

  const handleSave = async () => {
    if (!insumo) return setError('Escolha o item que está entrando no estoque.');
    if (!(packages > 0)) return setError('Informe quantas embalagens foram compradas.');
    if (!(unitsPerPackage > 0)) return setError(`Informe quanto vem em cada embalagem (${unit}).`);
    let expiresAt;
    try {
      expiresAt = parseDateBR(expiry);
    } catch (parseError) {
      return setError(parseError.message);
    }

    setSaving(true);
    setError('');
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
    } catch (saveError) {
      setError(saveError.message);
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      title="Entrada de compra"
      subtitle="Informe a compra como ela vem na nota: quantas embalagens e quanto vem em cada uma."
      onClose={onClose}
      onSubmit={handleSave}
      footer={(
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Salvando…' : 'Dar entrada'}</button>
        </div>
      )}
    >
      {error && <div className="error-banner" role="alert">{error}</div>}

      <Field label="Item">
        {initialInsumo ? (
          <strong>{initialInsumo.name}</strong>
        ) : (
          <select value={insumoId} onChange={(event) => chooseInsumo(event.target.value)}>
            <option value="">Escolha o item</option>
            {[...insumos]
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((item) => <option key={item.id} value={item.id}>{item.name} ({item.unit})</option>)}
          </select>
        )}
      </Field>

      <div className="form-row">
        <Field label="Embalagem">
          <select value={packageType} onChange={(event) => setPackageType(event.target.value)}>
            {PACKAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="Quantidade de embalagens">
          <NumberInput min={0} placeholder="Ex: 3" label="Quantidade de embalagens" value={packages} onChange={setPackages} />
        </Field>
      </div>

      <div className="form-row">
        <Field label={`Quanto vem em cada ${packageLabel.toLowerCase()}`} hint={`Na unidade usada nos procedimentos (ex: caixa com 10 ampolas = 10 ${unit}).`}>
          <NumberInput min={0} placeholder="Ex: 10" label="Quanto vem em cada embalagem" value={unitsPerPackage} onChange={setUnitsPerPackage} suffix={unit} />
        </Field>
        <Field label={`Preço por ${packageLabel.toLowerCase()}`}>
          <NumberInput prefix="R$" min={0} placeholder="0,00" label="Preço por embalagem" value={pricePerPackage} onChange={setPricePerPackage} />
        </Field>
      </div>

      <div className="cost-box">
        <div>
          <span>Entra no estoque</span>
          <small>{formatDecimal(packages, 3)} × {formatDecimal(unitsPerPackage, 3)} {unit} · total {formatBRL(totalCost)}</small>
        </div>
        <div className="cost-box-right">
          <strong>{formatDecimal(quantity, 3)} {unit}</strong>
          <small>{unitCost > 0 ? `${formatUnitCost(unitCost)} / ${unit}` : '—'}</small>
        </div>
      </div>

      <div className="form-row">
        <Field label="Número do lote (opcional)">
          <input type="text" placeholder="Ex: L2026-045" value={lotNumber} onChange={(event) => setLotNumber(event.target.value.toUpperCase())} />
        </Field>
        <Field label="Validade (opcional)">
          <input
            type="text"
            inputMode="numeric"
            placeholder="DD/MM/AAAA"
            maxLength={10}
            value={expiry}
            onChange={(event) => {
              setExpiry(maskDateBR(event.target.value));
              setError('');
            }}
          />
        </Field>
      </div>
      {expiryWarning && <p className="warning">{expiryWarning}</p>}

      <Field label="Observação (opcional)">
        <input type="text" placeholder="Ex: Nota fiscal 1234, fornecedor X" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>

      <label className="checkbox">
        <input type="checkbox" checked={updateCost} onChange={(event) => setUpdateCost(event.target.checked)} />
        Atualizar o custo do item com o preço desta compra (recalcula os procedimentos)
      </label>
    </Modal>
  );
}
