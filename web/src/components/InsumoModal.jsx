import { useState } from 'react';
import { formatBRL, formatDecimal, formatUnitCost } from '../utils/costCalculations';
import { Field, Modal, NumberInput } from './ui';

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
  const [error, setError] = useState('');

  const packageLabel = PACKAGE_OPTIONS.find((option) => option.value === packageType)?.label.toLowerCase() ?? 'embalagem';
  const isMasculine = MASCULINE_PACKAGES.includes(packageType);
  const ofThe = isMasculine ? 'do' : 'da';
  const inThe = isMasculine ? 'no' : 'na';
  const costPerUnit = directCost ? manualCost : packagePrice > 0 && packageSize > 0 ? packagePrice / packageSize : 0;

  const handleSave = () => {
    const cleanName = name.trim();
    const cleanNotes = notes.trim();
    if (!cleanName) return setError('Informe o nome do insumo.');
    if (cleanName.length > 100) return setError('O nome do insumo é muito longo (máximo de 100 caracteres).');
    if (cleanNotes.length > 255) return setError('As observações devem ter no máximo 255 caracteres.');
    if (!directCost) {
      if (packagePrice <= 0) return setError(`Informe o preço pago ${isMasculine ? 'pelo' : 'pela'} ${packageLabel}.`);
      if (packageSize <= 0) return setError(`Informe a quantidade que vem ${inThe} ${packageLabel}.`);
    } else if (manualCost <= 0) {
      return setError('O custo unitário deve ser maior que zero.');
    }

    return onSave({
      id: insumo?.id ?? `ins_${Date.now()}`,
      name: cleanName,
      category,
      unit,
      costPerUnit,
      packageType: directCost ? undefined : packageType,
      packagePrice: directCost ? undefined : packagePrice,
      packageSize: directCost ? undefined : packageSize,
      notes: cleanNotes || undefined,
    });
  };

  const unitSelect = (
    <select aria-label="Unidade de uso" value={unit} onChange={(event) => setUnit(event.target.value)}>
      {UNIT_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
  );

  return (
    <Modal
      title={isEditing ? 'Editar insumo' : 'Novo insumo'}
      subtitle="Alterações no custo refletem em todos os procedimentos que usam este item."
      onClose={onClose}
      onSubmit={handleSave}
      footer={
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Cancelar</button>
          <button type="submit" className="btn btn-primary">Salvar</button>
        </div>
      }
    >
      {error && <div className="error-banner" role="alert">{error}</div>}

      <div className="form-row">
        <Field label="Nome" className="grow-2">
          <input
            type="text"
            placeholder="Ex: Luvas cirúrgicas estéreis"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setError('');
            }}
          />
        </Field>
        <Field label="Categoria">
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            {CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
      </div>

      {!directCost ? (
        <section className="form-group">
          <h3>Como você compra</h3>
          <div className="form-row">
            <Field label="Embalagem">
              <select value={packageType} onChange={(event) => setPackageType(event.target.value)}>
                {PACKAGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </Field>
            <Field label={`Preço ${ofThe} ${packageLabel}`}>
              <NumberInput prefix="R$" min={0} placeholder="0,00" value={packagePrice} onChange={(value) => { setPackagePrice(value); setError(''); }} />
            </Field>
          </div>
          <Field
            label={`Quantidade ${inThe} ${packageLabel}`}
            hint="Use a unidade em que o item é gasto nos procedimentos (ex: caixa de luvas = 50 par; frasco de shampoo = 5000 ml)."
          >
            <div className="inline">
              <NumberInput min={0} placeholder="Ex: 20" value={packageSize} onChange={(value) => { setPackageSize(value); setError(''); }} className="w-small" />
              {unitSelect}
            </div>
          </Field>
          <div className="cost-box">
            <div>
              <span>Custo unitário</span>
              {costPerUnit > 0 && <small>{formatBRL(packagePrice)} ÷ {formatDecimal(packageSize, 3)} {unit}</small>}
            </div>
            <strong>{costPerUnit > 0 ? `${formatUnitCost(costPerUnit)} / ${unit}` : '—'}</strong>
          </div>
        </section>
      ) : (
        <section className="form-group">
          <h3>Custo unitário</h3>
          <div className="inline">
            <NumberInput prefix="R$" min={0} label="Custo unitário" value={manualCost} onChange={(value) => { setManualCost(value); setError(''); }} className="w-small" />
            <span className="muted">por</span>
            {unitSelect}
          </div>
        </section>
      )}

      <label className="checkbox">
        <input
          type="checkbox"
          checked={directCost}
          onChange={(event) => {
            // Ao trocar para custo direto, parte do valor que a embalagem calculava
            if (event.target.checked && costPerUnit > 0) setManualCost(Number(costPerUnit.toFixed(4)));
            setDirectCost(event.target.checked);
            setError('');
          }}
        />
        Informar custo unitário direto (sem embalagem, ex: kWh, diária)
      </label>

      <Field label="Observações (opcional)">
        <input type="text" placeholder="Ex: Lâmina nº 15 estéril" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </Field>
    </Modal>
  );
}
