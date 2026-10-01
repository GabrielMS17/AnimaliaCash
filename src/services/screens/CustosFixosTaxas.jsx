import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function CustosETaxasScreen({ goToLogin }) {
  const [tab, setTab] = useState('custos');

  // Dados fictícios de Custos Fixos
  const custosFixos = [
    { id: '1', nome: 'Aluguel do Imóvel', categoria: 'Estrutura', valor: 'R$ 4.500,00' },
    { id: '2', nome: 'Energia Elétrica', categoria: 'Utilidades', valor: 'R$ 1.200,00' },
    { id: '3', nome: 'Folha Salarial Fixa', categoria: 'Pessoal', valor: 'R$ 12.800,00' },
    { id: '4', nome: 'Serviços Contábeis', categoria: 'Administrativo', valor: 'R$ 850,00' },
  ];

  // Dados fictícios de Taxas de Pagamento
  const taxasPagamento = [
    { id: '1', bandeira: 'PIX', forma: 'À vista / Instantâneo', taxa: '0,99%' },
    { id: '2', bandeira: 'Cartão de Débito', forma: 'Débito', taxa: '1,49%' },
    { id: '3', bandeira: 'Cartão de Crédito', forma: 'Crédito à vista', taxa: '3,19%' },
    { id: '4', bandeira: 'Cartão de Crédito', forma: 'Crédito Parcelado (2x a 6x)', taxa: '4,89%' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Navbar Superior */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.logoText}>Animalia Cash</Text>
          <Text style={styles.subLogoText}>Clínica Veterinária Vida Animal</Text>
        </View>

        {/* Botão de Logout para voltar ao Login */}
        {goToLogin && (
          <TouchableOpacity onPress={goToLogin} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Banner do Módulo */}
        <View style={styles.headerCard}>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle}>Custos Fixos e Taxas</Text>
            <Text style={styles.headerSubtitle}>
              Gerencie custos operacionais, cálculo de hora/sala e taxas de meios de pagamento.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {tab === 'custos' ? '+ Novo Custo Fixo' : '+ Nova Taxa'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Métrica / Indicador do Cálculo Hora/Sala */}
        <View style={styles.metricCard}>
          <View>
            <Text style={styles.metricTitle}>Hora/Sala Operacional Calculada</Text>
            <Text style={styles.metricSub}>Baseado na estrutura e custos fixos mensais cadastrados</Text>
          </View>
          <Text style={styles.metricValue}>R$ 42,50 / hora</Text>
        </View>

        {/* Filtros / Tabs */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'custos' && styles.tabButtonActive]}
            onPress={() => setTab('custos')}
          >
            <Text style={[styles.tabText, tab === 'custos' && styles.tabTextActive]}>
              Custos Fixos Mensais
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'taxas' && styles.tabButtonActive]}
            onPress={() => setTab('taxas')}
          >
            <Text style={[styles.tabText, tab === 'taxas' && styles.tabTextActive]}>
              Taxas de Meios de Pagamento
            </Text>
          </TouchableOpacity>
        </View>

        {/* Tabela de Custos Fixos / Taxas */}
        {tab === 'custos' ? (
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Nome / Descrição</Text>
              <Text style={[styles.columnHeader, { flex: 1 }]}>Categoria</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Valor Mensal</Text>
            </View>

            {custosFixos.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cellTextBold, { flex: 2 }]}>{item.nome}</Text>
                <Text style={[styles.cellText, { flex: 1 }]}>{item.categoria}</Text>
                <Text style={[styles.cellTextBold, { flex: 1, textAlign: 'right' }]}>{item.valor}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.tableCard}>
            <View style={styles.tableHeader}>
              <Text style={[styles.columnHeader, { flex: 1.5 }]}>Meio / Bandeira</Text>
              <Text style={[styles.columnHeader, { flex: 2 }]}>Forma de Pagamento</Text>
              <Text style={[styles.columnHeader, { flex: 1, textAlign: 'right' }]}>Taxa (%)</Text>
            </View>

            {taxasPagamento.map((item) => (
              <View key={item.id} style={styles.tableRow}>
                <Text style={[styles.cellTextBold, { flex: 1.5 }]}>{item.bandeira}</Text>
                <Text style={[styles.cellText, { flex: 2 }]}>{item.forma}</Text>
                <Text style={[styles.cellBadge, { flex: 1, textAlign: 'right' }]}>{item.taxa}</Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  navbar: {
    backgroundColor: '#0F172A',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoText: {
    color: '#00E676',
    fontWeight: 'bold',
    fontSize: 18,
  },
  subLogoText: {
    color: '#94A3B8',
    fontSize: 12,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#1E293B',
  },
  logoutButtonText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  content: {
    padding: 24,
    maxWidth: 1200,
    alignSelf: 'center',
    width: '100%',
  },
  headerCard: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#0F172A',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  primaryButtonText: {
    color: '#FFF',
    fontWeight: 'bold',
    fontSize: 14,
  },
  metricCard: {
    backgroundColor: '#FFF',
    padding: 18,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  metricTitle: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#1E293B',
  },
  metricSub: {
    fontSize: 12,
    color: '#64748B',
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#22C55E',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  tabButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    backgroundColor: '#E2E8F0',
  },
  tabButtonActive: {
    backgroundColor: '#0F172A',
  },
  tabText: {
    color: '#475569',
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#FFF',
  },
  tableCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  tableHeader: {
    flexDirection: 'row',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  columnHeader: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#64748B',
    textTransform: 'uppercase',
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    alignItems: 'center',
  },
  cellTextBold: {
    fontWeight: 'bold',
    color: '#1E293B',
    fontSize: 14,
  },
  cellText: {
    color: '#64748B',
    fontSize: 14,
  },
  cellBadge: {
    color: '#0F172A',
    fontWeight: 'bold',
  },
});