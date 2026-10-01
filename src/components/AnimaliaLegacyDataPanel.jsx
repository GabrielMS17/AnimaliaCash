import { Link } from "expo-router";
import { useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import {
  initialClinicSettings,
  initialInsumos,
  initialProcedures,
} from "../data/initialData";
import {
  calculateProcedure,
  formatBRL,
  formatDuration,
} from "../utils/costCalculations";

const procedureCategories = [
  { id: "banho_tosa", label: "Banho & Tosa" },
  { id: "cirurgia", label: "Cirurgias" },
  { id: "internacao", label: "Internação" },
];

const supplyCategories = [
  { id: "todos", label: "Todos" },
  { id: "banho_tosa", label: "Banho & Tosa" },
  { id: "cirurgia", label: "Cirurgias" },
  { id: "internacao", label: "Internação" },
  { id: "geral", label: "Geral" },
];

const moduleRoutes = [
  { href: "/banho-tosa", label: "Banho & Tosa" },
  { href: "/cirurgia", label: "Cirurgias" },
  { href: "/internacao", label: "Internação" },
  { href: "/insumos", label: "Insumos" },
  { href: "/configuracoes", label: "Configurações" },
];

const suppliesById = new Map(initialInsumos.map((item) => [item.id, item]));

function FilterButton({ active, label, onPress }) {
  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.filterButton, active && styles.filterButtonActive]}
    >
      <Text style={[styles.filterText, active && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

export default function AnimaliaLegacyDataPanel({
  initialView = "procedimentos",
  initialProcedureCategory = "cirurgia",
  screenTitle = "Animalia Cash Velho",
  currentRoute,
}) {
  const [view, setView] = useState(initialView);
  const [procedureCategory, setProcedureCategory] = useState(
    initialProcedureCategory,
  );
  const [supplyCategory, setSupplyCategory] = useState("todos");

  const procedures = initialProcedures.filter(
    (item) => item.category === procedureCategory,
  );
  const supplies = initialInsumos.filter(
    (item) => supplyCategory === "todos" || item.category === supplyCategory,
  );

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>{screenTitle}</Text>
        <Text style={styles.subtitle}>
          Catálogos e configurações importados do projeto anterior.
        </Text>
      </View>

      <View style={styles.filterRow}>
        {moduleRoutes.map((route) => {
          const active = currentRoute === route.href;
          return (
            <Link key={route.href} href={route.href} asChild>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={StyleSheet.flatten([
                  styles.filterButton,
                  active && styles.filterButtonActive,
                ])}
              >
                <Text
                  style={[styles.filterText, active && styles.filterTextActive]}
                >
                  {route.label}
                </Text>
              </TouchableOpacity>
            </Link>
          );
        })}
      </View>

      <View style={styles.filterRow}>
        <FilterButton
          active={view === "procedimentos"}
          label="Procedimentos"
          onPress={() => setView("procedimentos")}
        />
        <FilterButton
          active={view === "insumos"}
          label="Insumos"
          onPress={() => setView("insumos")}
        />
        <FilterButton
          active={view === "configuracoes"}
          label="Configurações"
          onPress={() => setView("configuracoes")}
        />
      </View>

      {view === "procedimentos" && (
        <View>
          <View style={styles.filterRow}>
            {procedureCategories.map((category) => (
              <FilterButton
                key={category.id}
                active={procedureCategory === category.id}
                label={category.label}
                onPress={() => setProcedureCategory(category.id)}
              />
            ))}
          </View>
          <Text style={styles.resultCount}>
            {procedures.length} procedimentos
          </Text>
          {procedures.map((procedure) => {
            const calculation = calculateProcedure(
              procedure,
              suppliesById,
              initialClinicSettings,
            );

            return (
              <View key={procedure.id} style={styles.card}>
                <Text style={styles.cardTitle}>{procedure.name}</Text>
                <Text style={styles.description}>{procedure.description}</Text>
                <Text style={styles.metadata}>
                  {procedure.targetWeightKg
                    ? `${procedure.targetWeightKg} kg`
                    : "Sem peso definido"}
                  {"  |  "}
                  {formatDuration(
                    procedure.durationMinutes,
                    procedure.category,
                  )}
                  {"  |  "}
                  {calculation.itemsCount} insumos
                </Text>
                <View style={styles.costRow}>
                  <Text style={styles.costLabel}>Custo calculated</Text>
                  <Text style={styles.costValue}>
                    {formatBRL(calculation.breakdown.totalCost)}
                  </Text>
                </View>
                {calculation.itemDetails.map((item) => (
                  <View
                    key={`${procedure.id}-${item.insumoId}`}
                    style={styles.itemRow}
                  >
                    <Text style={styles.itemName}>
                      {item.insumoName} x {item.quantity}
                      {item.unit ? ` ${item.unit}` : ""}
                    </Text>
                    <Text style={styles.itemCost}>
                      {formatBRL(item.totalItemCost)}
                    </Text>
                  </View>
                ))}
              </View>
            );
          })}
        </View>
      )}

      {view === "insumos" && (
        <View>
          <View style={styles.filterRow}>
            {supplyCategories.map((category) => (
              <FilterButton
                key={category.id}
                active={supplyCategory === category.id}
                label={category.label}
                onPress={() => setSupplyCategory(category.id)}
              />
            ))}
          </View>
          <Text style={styles.resultCount}>{supplies.length} insumos</Text>
          {supplies.map((item) => (
            <View key={item.id} style={styles.supplyRow}>
              <View style={styles.supplyDetails}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.description}>
                  {item.packageType ? `${item.packageType} | ` : ""}
                  {item.packageSize
                    ? `${item.packageSize} ${item.unit} | `
                    : ""}
                  {item.notes || "Sem observações"}
                </Text>
              </View>
              <Text style={styles.itemCost}>
                {formatBRL(item.costPerUnit)} / {item.unit}
              </Text>
            </View>
          ))}
        </View>
      )}

      {view === "configuracoes" && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>
            {initialClinicSettings.clinicName}
          </Text>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Custo operacional por hora</Text>
            <Text style={styles.itemCost}>
              {formatBRL(initialClinicSettings.hourlyOperationalRate)}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Custo padrão de anestesia</Text>
            <Text style={styles.itemCost}>
              {formatBRL(initialClinicSettings.defaultAnesthesiaCost || 0)}
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Comissão de cirurgia</Text>
            <Text style={styles.itemCost}>
              {initialClinicSettings.defaultVetCommissionSurgeryPercent}%
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Comissão de internação</Text>
            <Text style={styles.itemCost}>
              {initialClinicSettings.defaultVetCommissionInternmentPercent}%
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Comissão de banho e tosa</Text>
            <Text style={styles.itemCost}>
              {initialClinicSettings.defaultVetCommissionBathPercent}%
            </Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.itemName}>Incluir mão de obra no custo</Text>
            <Text style={styles.itemCost}>
              {initialClinicSettings.includeLaborInCost ? "Sim" : "Não"}
            </Text>
          </View>
          {(initialClinicSettings.externalProfessionals || []).map(
            (professional) => (
              <View key={professional.id} style={styles.settingRow}>
                <Text style={styles.itemName}>
                  {professional.name} | {professional.specialty}
                </Text>
                <Text style={styles.itemCost}>
                  {formatBRL(professional.defaultCost)}
                </Text>
              </View>
            ),
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  heading: {
    marginBottom: 2,
  },
  title: {
    color: "#1E293B",
    fontSize: 20,
    fontWeight: "700",
  },
  subtitle: {
    color: "#64748B",
    fontSize: 13,
    marginTop: 4,
  },
  filterRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  filterButton: {
    backgroundColor: "#E2E8F0",
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  filterButtonActive: {
    backgroundColor: "#0F172A",
  },
  filterText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  resultCount: {
    color: "#64748B",
    fontSize: 12,
    marginBottom: 8,
    marginTop: 2,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderColor: "#E2E8F0",
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 12,
    padding: 14,
  },
  cardTitle: {
    color: "#1E293B",
    fontSize: 16,
    fontWeight: "700",
  },
  description: {
    color: "#64748B",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  metadata: {
    color: "#475569",
    fontSize: 12,
    marginTop: 10,
  },
  costRow: {
    alignItems: "center",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    paddingBottom: 10,
  },
  costLabel: {
    color: "#334155",
    fontSize: 13,
    fontWeight: "600",
  },
  costValue: {
    color: "#047857",
    fontSize: 15,
    fontWeight: "700",
  },
  itemRow: {
    alignItems: "flex-start",
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 8,
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  itemName: {
    color: "#334155",
    flex: 1,
    fontSize: 12,
  },
  itemCost: {
    color: "#0F172A",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "right",
  },
  supplyRow: {
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderBottomColor: "#E2E8F0",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingVertical: 12,
  },
  supplyDetails: {
    flex: 1,
  },
  settingRow: {
    alignItems: "center",
    borderBottomColor: "#F1F5F9",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    justifyContent: "space-between",
    paddingVertical: 12,
  },
});