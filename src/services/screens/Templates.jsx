import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TemplatesScreen({ goToLogin }) {
  const [tab, setTab] = useState('todos');

  // Dados fictícios de Templates de Fichas Técnicas
  const templates = [
    {
      id: '1',
      nome: 'Banho Porte P',
      categoria: 'Estética / Banho e Tosa',
      tempoEstimado: '45 min',
      insumos: [
        { nome: 'Shampoo Neutro', quantidade: '30ml' },
        { nome: 'Condicionador Suave', quantidade: '15ml' },
        { nome: 'Toalha Descartável', quantidade: '1 un' },
        { nome: 'Perfume Pet Soft', quantidade: '2 borrifadas' },
      ],
    },
    {
      id: '2',
      nome: 'Castração Felina',
      categoria: 'Procedimento Cirúrgico',
      tempoEstimado: '60 min',
      insumos: [
        { nome: 'Anestésico X', quantidade: '2,5ml' },
        { nome: 'Fio de Satura Nylon 3-0', quantidade: '1 un' },
        { nome: 'Lâmina de Bisturi #15', quantidade: '1 un' },
        { nome: 'Luva Cirúrgica Estéril', quantidade: '1 par' },
        { nome: 'Gaze Estéril (Pacote)', quantidade: '2 pk' },
      ],
    },
    {
      id: '3',
      nome: 'Banho e Tosa Higiênica Porte M',
      categoria: 'Estética / Banho e Tosa',
      tempoEstimado: '60 min',
      insumos: [
        { nome: 'Shampoo Neutro', quantidade: '50ml' },
        { nome: 'Condicionador Suave', quantidade: '25ml' },
        { nome: 'Lâmina Tosa #10', quantidade: '1 uso' },
        { nome: 'Toalha Descartável', quantidade: '2 un' },
      ],
    },
    {
      id: '4',
      nome: 'Profilaxia Dental (Limpeza de Tártaro)',
      categoria: 'Procedimento Clínico',
      tempoEstimado: '90 min',
      insumos: [
        { nome: 'Anestésico Inalatório Isoflurano', quantidade: '15ml' },
        { nome: 'Pasta de Polimento Dental', quantidade: '5g' },
        { nome: 'Kit Agulha e Seringa 5ml', quantidade: '2 un' },
        { nome: 'Soro Fisiológico 500ml', quantidade: '1 frasco' },
      ],
    },
    {
      id: '5',
      nome: 'Vacinação Múltipla (V10)',
      categoria: 'Atendimento Clínico',
      tempoEstimado: '15 min',
      insumos: [
        { nome: 'Dose Vacina V10', quantidade: '1 frasco' },
        { nome: 'Seringa com Agulha 3ml', quantidade: '1 un' },
        { nome: 'Algodão com Álcool 70%', quantidade: '1 un' },
      ],
    },
  ];

  // Filtragem por Categoria
  const templatesFiltrados = templates.filter((item) => {
    if (tab === 'banho') return item.categoria.includes('Estética');
    if (tab === 'cirurgia') return item.categoria.includes('Cirúrgico');
    if (tab === 'clinico') return item.categoria.includes('Clínico');
    return true; // 'todos'
  });

  return (
    <ScrollView style={styles.container}>
      {/* Navbar Superior */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.logoText}>Animalia Cash</Text>
          <Text style={styles.subLogoText}>Clínica Veterinária Vida Animal</Text>
        </View>

        {/* Botão de Logout */}
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
            <Text style={styles.headerTitle}>Fichas Técnicas e Padrões (Templates)</Text>
            <Text style={styles.headerSubtitle}>
              Pré-configure insumos médios consumidos por procedimento para agilizar os lançamentos diários.
            </Text>
          </View>
          <TouchableOpacity style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>+ Criar Novo Template</Text>
          </TouchableOpacity>
        </View>

        {/* Card de Resumo do Módulo */}
        <View style={styles.metricCard}>
          <View>
            <Text style={styles.metricTitle}>Templates de Serviços Ativos</Text>
            <Text style={styles.metricSub}>Padronização de consumo e agilidade na operação diária</Text>
          </View>
          <Text style={styles.metricValue}>{templates.length} Cadastrados</Text>
        </View>

        {/* Tabs de Filtro */}
        <View style={styles.tabContainer}>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'todos' && styles.tabButtonActive]}
            onPress={() => setTab('todos')}
          >
            <Text style={[styles.tabText, tab === 'todos' && styles.tabTextActive]}>
              Todos ({templates.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabButton, tab === 'banho' && styles.tabButtonActive]}
            onPress={() => setTab('banho')}
          >
            <Text style={[styles.tabText, tab === 'banho' && styles.tabTextActive]}>
              Banho e Tosa
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

        {/* Lista de Templates */}
        <View style={styles.listContainer}>
          {templatesFiltrados.map((item) => (
            <View key={item.id} style={styles.templateCard}>
              {/* Cabeçalho do Card */}
              <View style={styles.templateHeader}>
                <View>
                  <Text style={styles.templateTitle}>{item.nome}</Text>
                  <Text style={styles.templateCategory}>{item.categoria}</Text>
                </View>
                <View style={styles.badgeContainer}>
                  <Text style={styles.badgeText}>⏱ {item.tempoEstimado}</Text>
                </View>
              </View>

              {/* Tabela de Insumos Preconfigurados */}
              <View style={styles.insumosTable}>
                <Text style={styles.insumosTitle}>Insumos Padrão Consumidos:</Text>
                {item.insumos.map((insumo, index) => (
                  <View key={index} style={styles.insumoRow}>
                    <Text style={styles.insumoNome}>• {insumo.nome}</Text>
                    <Text style={styles.insumoQtd}>{insumo.quantidade}</Text>
                  </View>
                ))}
              </View>

              {/* Ações do Card */}
              <View style={styles.templateFooter}>
                <TouchableOpacity style={styles.secondaryButton}>
                  <Text style={styles.secondaryButtonText}>Editar Template</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionLinkButton}>
                  <Text style={styles.actionLinkText}>Usar no Lançamento →</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </View>
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
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
    flexWrap: 'wrap',
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
  listContainer: {
    gap: 16,
  },
  templateCard: {
    backgroundColor: '#FFF',
    borderRadius: 10,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  templateHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    paddingBottom: 12,
  },
  templateTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  templateCategory: {
    fontSize: 13,
    color: '#64748B',
    marginTop: 2,
  },
  badgeContainer: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  insumosTable: {
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  insumosTitle: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#475569',
    marginBottom: 8,
  },
  insumoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  insumoNome: {
    fontSize: 14,
    color: '#1E293B',
  },
  insumoQtd: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  templateFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 6,
  },
  secondaryButtonText: {
    color: '#475569',
    fontWeight: '600',
    fontSize: 13,
  },
  actionLinkButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  actionLinkText: {
    color: '#0F172A',
    fontWeight: 'bold',
    fontSize: 13,
  },
});