import {
  calculateProcedure,
  formatBRL,
  formatDecimal,
  formatDuration,
  formatUnitCost,
  getCategoryLabel,
  getDefaultCommissionPercent,
  getLaborMinutes,
} from '../utils/costCalculations';
import { Modal } from './ui';

export default function ProcedureDetailModal({ procedure, insumosMap, settings, onClose, onEdit }) {
  const calc = calculateProcedure(procedure, insumosMap, settings);
  const { breakdown } = calc;

  const commissionLabel = procedure.vetCommissionType === 'fixed'
    ? 'valor fixo'
    : `${formatDecimal(procedure.vetCommissionValue ?? getDefaultCommissionPercent(procedure.category, settings))}% ${procedure.suggestedPrice ? 'do preço sem terceirizados' : 'de insumos + operacional'}`;

  const composition = [
    { label: 'Insumos', detail: `${calc.itemsCount} itens`, value: breakdown.directCost, color: '#6366F1' },
    ...calc.externalProfessionalDetails
      .filter((professional) => professional.cost > 0)
      .map((professional) => ({ label: professional.name, detail: professional.specialty, value: professional.cost, color: '#10B981' })),
    {
      label: 'Comissão',
      detail: [procedure.vetCommissionRole, commissionLabel].filter(Boolean).join(' · '),
      value: breakdown.vetCommissionCost,
      color: '#8B5CF6',
    },
    {
      label: 'Operacional',
      detail: settings.includeLaborInCost
        ? `${formatDuration(getLaborMinutes(procedure))} × ${formatBRL(settings.hourlyOperationalRate)}/h`
        : 'mão de obra não incluída',
      value: breakdown.operationalCost,
      color: '#94A3B8',
    },
  ];

  const subtitle = [
    getCategoryLabel(procedure.category),
    procedure.targetWeightKg ? `${procedure.targetWeightKg} kg` : null,
    formatDuration(procedure.durationMinutes, procedure.category),
  ].filter(Boolean).join(' · ');

  return (
    <Modal
      title={procedure.name}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="actions-end">
          <button type="button" className="btn btn-secondary" onClick={onClose}>Fechar</button>
          <button type="button" className="btn btn-primary" onClick={() => onEdit(procedure)}>Editar</button>
        </div>
      }
    >
      {procedure.description && <p className="description">{procedure.description}</p>}

      <section>
        <div className="total-row">
          <span className="muted">Custo total</span>
          <strong>{formatBRL(breakdown.totalCost)}</strong>
        </div>
        <div className="cost-bar" aria-hidden="true">
          {composition.map((part) =>
            breakdown.totalCost > 0 && part.value > 0
              ? <span key={`${part.label}-${part.detail}`} style={{ flexGrow: part.value, background: part.color }} />
              : null,
          )}
        </div>
        {composition.map((part) => (
          <div key={`${part.label}-${part.detail}`} className="composition-row">
            <i className="dot" style={{ background: part.color }} />
            <strong>{part.label}</strong>
            <span className="truncate">{part.detail}</span>
            <b>{formatBRL(part.value)}</b>
          </div>
        ))}
      </section>

      <section>
        <h3>Insumos utilizados</h3>
        {calc.itemDetails.length > 0 ? (
          calc.itemDetails.map((item, index) => (
            <div key={`${item.insumoId}-${index}`} className="item-row">
              <div>
                <span className={item.missing ? 'warning' : ''}>
                  {item.missing ? `⚠ Insumo não encontrado (${item.insumoId})` : item.insumoName}
                </span>
                {!item.missing && <small>{formatUnitCost(item.costPerUnit)} / {item.unit}</small>}
              </div>
              <span className="muted nowrap">{formatDecimal(item.quantity, 3)} {item.unit}</span>
              <b>{formatBRL(item.totalItemCost)}</b>
            </div>
          ))
        ) : (
          <p className="muted">Nenhum insumo vinculado.</p>
        )}
      </section>
    </Modal>
  );
}
