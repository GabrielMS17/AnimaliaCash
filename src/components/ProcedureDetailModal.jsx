import { StyleSheet, Text, View } from 'react-native';
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
import { AppModal, Button, COLORS } from './ui';

export default function ProcedureDetailModal({ procedure, insumosMap, settings, onClose, onEdit }) {
  const calc = calculateProcedure(procedure, insumosMap, settings);
  const { breakdown } = calc;

  const commissionLabel = procedure.vetCommissionType === 'fixed'
    ? 'valor fixo'
    : `${formatDecimal(procedure.vetCommissionValue ?? getDefaultCommissionPercent(procedure.category, settings))}% ${procedure.suggestedPrice ? 'do preço' : 'do custo'}`;

  const composition = [
    { label: 'Insumos', detail: `${calc.itemsCount} itens`, value: breakdown.directCost, color: '#6366F1' },
    ...calc.externalProfessionalDetails
      .filter((professional) => professional.cost > 0)
      .map((professional) => ({
        label: professional.name,
        detail: professional.specialty,
        value: professional.cost,
        color: '#10B981',
      })),
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
    <AppModal
      title={procedure.name}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <View style={styles.footer}>
          <Button label="Fechar" variant="secondary" onPress={onClose} />
          <Button label="Editar" onPress={() => onEdit(procedure)} />
        </View>
      }
    >
      {procedure.description ? <Text style={styles.description}>{procedure.description}</Text> : null}

      <View>
        <View style={styles.totalRow}>
          <Text style={styles.muted}>Custo total</Text>
          <Text style={styles.total}>{formatBRL(breakdown.totalCost)}</Text>
        </View>

        <View style={styles.bar}>
          {composition.map((part) =>
            breakdown.totalCost > 0 && part.value > 0 ? (
              <View key={`${part.label}-${part.detail}`} style={{ flex: part.value, backgroundColor: part.color }} />
            ) : null,
          )}
        </View>

        {composition.map((part) => (
          <View key={`${part.label}-${part.detail}`} style={styles.compositionRow}>
            <View style={[styles.dot, { backgroundColor: part.color }]} />
            <Text style={styles.compositionLabel}>{part.label}</Text>
            <Text style={styles.compositionDetail} numberOfLines={1}>{part.detail}</Text>
            <Text style={styles.value}>{formatBRL(part.value)}</Text>
          </View>
        ))}
      </View>

      <View>
        <Text style={styles.heading}>Insumos utilizados</Text>
        {calc.itemDetails.length > 0 ? (
          calc.itemDetails.map((item, index) => (
            <View key={`${item.insumoId}-${index}`} style={styles.itemRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.itemName, item.missing && { color: COLORS.warning }]}>
                  {item.missing ? `⚠ Insumo não encontrado (${item.insumoId})` : item.insumoName}
                </Text>
                {!item.missing && <Text style={styles.small}>{formatUnitCost(item.costPerUnit)} / {item.unit}</Text>}
              </View>
              <Text style={styles.quantity}>{formatDecimal(item.quantity, 3)} {item.unit}</Text>
              <Text style={styles.value}>{formatBRL(item.totalItemCost)}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.muted}>Nenhum insumo vinculado.</Text>
        )}
      </View>
    </AppModal>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  description: { fontSize: 14, color: COLORS.textSoft, lineHeight: 20 },
  totalRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  total: { fontSize: 28, fontWeight: '800', color: COLORS.text },
  muted: { fontSize: 13, color: COLORS.muted },
  bar: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    backgroundColor: '#F1F5F9',
    marginVertical: 14,
  },
  compositionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  compositionLabel: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  compositionDetail: { flex: 1, fontSize: 13, color: COLORS.faint },
  value: { fontSize: 14, fontWeight: '600', color: COLORS.text, minWidth: 80, textAlign: 'right' },
  heading: { fontSize: 14, fontWeight: '700', color: COLORS.text, marginBottom: 6 },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  itemName: { fontSize: 14, color: COLORS.text },
  small: { fontSize: 12, color: COLORS.faint },
  quantity: { fontSize: 13, color: COLORS.muted },
});
