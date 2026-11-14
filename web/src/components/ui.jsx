import { useEffect, useState } from 'react';

/** Cada seção tem sua cor de destaque, aplicada a botões, abas e filtros ativos (ver Layout). */
// Mesma ordem da navegação do app; cada perfil vê só as telas liberadas para ele
export const SECTIONS = [
  { path: '/cadastros', label: 'Cadastros', accent: '#0C2D48', soft: '#E2E8F0' },
  { path: '/custos', label: 'Custos e Taxas', accent: '#0C2D48', soft: '#E2E8F0' },
  { path: '/estoque', label: 'Estoque', accent: '#00A86B', soft: '#D1FAE5' },
  { path: '/templates', label: 'Templates', accent: '#0C2D48', soft: '#E2E8F0' },
  { path: '/banho-tosa', label: 'Banho & Tosa', accent: '#0284C7', soft: '#E0F2FE' },
  { path: '/cirurgia', label: 'Cirurgias', accent: '#E11D48', soft: '#FFE4E6' },
  { path: '/internacao', label: 'Internação', accent: '#D97706', soft: '#FEF3C7' },
  { path: '/configuracoes', label: 'Configurações', accent: '#0C2D48', soft: '#E2E8F0', hidden: true },
];

export const CATEGORY_DOT = {
  banho_tosa: '#0EA5E9',
  cirurgia: '#F43F5E',
  internacao: '#F59E0B',
  geral: '#94A3B8',
};

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`field ${className}`}>
      {label && <span className="field-label">{label}</span>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

function parseDraft(value) {
  const normalized = value.trim().replace(',', '.');
  if (!normalized || normalized.endsWith('.')) return null;
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

const toDraft = (value) => (value === undefined || value === null ? '' : String(value).replace('.', ','));

/** Campo numérico que aceita vírgula e mantém o texto digitado enquanto está em foco. */
export function NumberInput({ value, onChange, min, max, prefix, suffix, placeholder, className = '', label }) {
  const [draft, setDraft] = useState(toDraft(value));
  const [focused, setFocused] = useState(false);

  return (
    <div className={`affix ${className}`}>
      {prefix && <span>{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        placeholder={placeholder}
        value={focused ? draft : toDraft(value)}
        onFocus={() => {
          setDraft(toDraft(value));
          setFocused(true);
        }}
        onChange={(event) => {
          setDraft(event.target.value);
          const parsed = parseDraft(event.target.value);
          if (parsed !== null) onChange(parsed);
        }}
        onBlur={() => {
          setFocused(false);
          const parsed = parseDraft(draft);
          let next = parsed ?? (draft.trim() === '' ? 0 : value ?? 0);
          if (min !== undefined) next = Math.max(min, next);
          if (max !== undefined) next = Math.min(max, next);
          onChange(next);
        }}
      />
      {suffix && <span>{suffix}</span>}
    </div>
  );
}

/** Grupo de botões de filtro ou de abas. */
export function Segmented({ options, value, onChange, label }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={option.value === value ? 'active' : ''}
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, description, action }) {
  return (
    <div className="section-header">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Modal({ title, subtitle, onClose, footer, children, wide = false, onSubmit }) {
  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const Container = onSubmit ? 'form' : 'div';
  const containerProps = onSubmit
    ? {
        onSubmit: (event) => { event.preventDefault(); onSubmit(); },
        // Enter em um campo (ex: filtro de insumos) não deve salvar o formulário
        onKeyDown: (event) => { if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault(); },
        noValidate: true,
      }
    : {};

  return (
    <div className="backdrop">
      <Container className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title} {...containerProps}>
        <header className="modal-header">
          <div>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Fechar">✕</button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </Container>
    </div>
  );
}
