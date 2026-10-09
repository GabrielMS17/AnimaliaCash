import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppHeader from '../../components/AppHeader';

export default function TemplatesScreen() {
  const [tab, setTab] = useState('todos');

  // Dados fictícios de Templates de Fichas Técnicas
  const templates = [
    {
      id: '1',
      nome: 'Banho Porte P',
      categoria: 'Estética',
      tempoEstimado: '45 min',
      insumosCount: 4,
    },
    {
      id: '2',
      nome: 'Castração Felina',
      categoria: 'Cirúrgico',
      tempoEstimado: '60 min',
      insumosCount: 5,
    },
    {
      id: '3',
      nome: 'Banho e Tosa Higiênica Porte M',
      categoria: 'Estética',
      tempoEstimado: '60 min',
      insumosCount: 4,
    },
    {
      id: '4',
      nome: 'Profilaxia Dental',
      categoria: 'Clínico',
      tempoEstimado: '90 min',
      insumosCount: 4,
    },
    {
      id: '5',
      nome: 'Vacinação Múltipla (V10)',
      categoria: 'Clínico',
      tempoEstimado: '15 min',
      insumosCount: 3,
    },
  ];

  // Filtragem por Categoria
  const templatesFiltrados = templates.filter((item) => {
    if (tab === 'banho') return item.categoria === 'Estética';
    if (tab === 'cirurgia') return item.categoria === 'Cirúrgico';
    if (tab === 'clinico') return item.categoria === 'Clínico';
    return true; // 'todos'
  });

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Templates e Fichas Técnicas</Text>
          <Text style={styles.sectionSubtitle}>
            Pré-configure insumos médios consumidos por procedimento para padronizar custos e lançamentos.
          </Text>
        </View>

        {/* Card de Métrica / Resumo */}
        <View style={styles.card}>
          <View style={styles.metricRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.metricTitle}>Templates de Serviços Ativos</Text>
              <Text style={styles.metricSub}>Padronização de consumo e agilidade na operação diária</Text>
            </View>
            <Text style={styles.metricValue}>{templates.length} ativos</Text>
          </View>
        </View>

        {/* Botão de Ação Primário */}
        <TouchableOpacity style={styles.buttonPrimary}>
          <Text style={styles.buttonText}>+ Criar Novo Template</Text>
        </TouchableOpacity>

        {/* Filtros / Tabs Estilizados */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'todos' && styles.tabButtonActive]}
            onPress={() => setTab('todos')}
          >
            <Text style={[styles.tabText, tab === 'todos' && styles.tabTextActive]}>
              Todos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'banho' && styles.tabButtonActive]}
            onPress={() => setTab('banho')}
          >
            <Text style={[styles.tabText, tab === 'banho' && styles.tabTextActive]}>
              Estética
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'cirurgia' && styles.tabButtonActive]}
            onPress={() => setTab('cirurgia')}
          >
            <Text style={[styles.tabText, tab === 'cirurgia' && styles.tabTextActive]}>
              Cirúrgicos
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.tabButton, tab === 'clinico' && styles.tabButtonActive]}
            onPress={() => setTab('clinico')}
          >
            <Text style={[styles.tabText, tab === 'clinico' && styles.tabTextActive]}>
              Clínicos
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabela de Templates */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Procedimentos Padronizados</Text>
          <View style={styles.tableHeader}>
            <Text style={[styles.columnHeader, { flex: 2 }]}>Nome do Procedimento</Text>
            <Text style={[styles.columnHeader, { flex: 1.2 }]}>Categoria</Text>
            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'center' }]}>Insumos</Text>
            <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Tempo Est.</Text>
          </View>

          {templatesFiltrados.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
              <Text style={[styles.cellText, { flex: 1.2 }]}>{item.categoria}</Text>
              <Text style={[styles.cellText, { flex: 1, textAlign: 'center' }]}>
                {item.insumosCount} itens
              </Text>
              <Text style={[styles.cellBadge, { flex: 1, textAlign: 'right' }]}>
                {item.tempoEstimado}
              </Text>
            </View>
          ))}
        </View>

        {/* Rodapé Corporativo */}
        <View style={styles.footerContainer}>
          <Text style={styles.footerText}>
            © {new Date().getFullYear()} Animalia Cash — Soluções Financeiras
          </Text>
          <Text style={styles.footerSubtext}>Todos os direitos reservados.</Text>
        </View>
      </ScrollView>
    </View>
  );
}

const PRIMARY_DARK = '#0C2D48';
const ACCENT_GREEN = '#00A86B';
const BG_LIGHT = '#F8FAFC';

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: BG_LIGHT },
  container: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 32 },
  pageHeader: { marginBottom: 16 },
  sectionTitle: { fontSize: 22, fontWeight: '700', color: PRIMARY_DARK },
  sectionSubtitle: { fontSize: 13, color: '#64748B', marginTop: 4 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
  },
  cardTitle: { fontSize: 16, fontWeight: '700', color: PRIMARY_DARK, marginBottom: 14 },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricTitle: { fontWeight: '700', fontSize: 15, color: PRIMARY_DARK },
  metricSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
  metricValue: { fontSize: 18, fontWeight: '800', color: ACCENT_GREEN },
  buttonPrimary: {
    backgroundColor: ACCENT_GREEN,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    alignItems: 'center',
    marginRight: 6,
  },
  tabButtonActive: {
    backgroundColor: PRIMARY_DARK,
    borderColor: PRIMARY_DARK,
  },
  tabText: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  cellTextBold: {
    fontWeight: '700',
    color: PRIMARY_DARK,
    fontSize: 13,
  },
  cellText: {
    color: '#64748B',
    fontSize: 13,
  },
  cellBadge: {
    fontSize: 13,
    fontWeight: '700',
    color: ACCENT_GREEN,
  },
  footerContainer: {
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: { fontSize: 12, fontWeight: '600', color: '#64748B' },
  footerSubtext: { fontSize: 10, color: '#94A3B8', marginTop: 2 },
});