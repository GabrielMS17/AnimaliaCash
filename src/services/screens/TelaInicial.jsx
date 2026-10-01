import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TelaInicial({ onLogout, onSelectModule }) {
  const menuItems = [
    { id: 'admin', titulo: 'Admin', descricao: 'Configurações de usuários e permissões do sistema' },
    { id: 'templates', titulo: 'Templates', descricao: 'Fichas técnicas e padronização de procedimentos' },
    { id: 'lancamentos', titulo: 'Lançamentos Diários', descricao: 'Registro de procedimentos, insumos e vendas' },
    { id: 'relatorios', titulo: 'Relatórios', descricao: 'DRE, margens de lucro e análise financeira' },
  ];

  return (
    <View style={styles.mainWrapper}>
      {/* Header Institucional Padronizado */}
      <View style={styles.headerContainer}>
        <View style={styles.headerTextGroup}>
          <Text style={styles.brandTitle}>
            Animalia<Text style={styles.brandSubtitle}>Cash</Text>
          </Text>
          <Text style={styles.brandTagline}>SOLUÇÕES FINANCEIRAS</Text>
        </View>

        {onLogout && (
          <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Painel Principal</Text>

          {/* Subtítulo Institucional / Nome da Clínica */}
          <Text style={styles.sectionSubtitle}>
            Clínica Veterinária Vida Animal — Visão Geral dos Módulos
          </Text>
        </View>

        {/* Card de Boas-Vindas */}
        <View style={styles.card}>
          <Text style={styles.welcomeTitle}>Bem-vindo ao Animalia Cash</Text>
          <Text style={styles.welcomeSubtitle}>
            Selecione um dos módulos abaixo para gerir a sua clínica veterinária, acompanhar relatórios e padronizar procedimentos.
          </Text>
        </View>

        {/* Grelha de Módulos */}
        <View style={styles.gridContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              activeOpacity={0.7}
              onPress={() => onSelectModule && onSelectModule(item.id)}
            >
              <Text style={styles.menuTitle}>{item.titulo}</Text>
              <Text style={styles.menuDescription}>{item.descricao}</Text>
              <Text style={styles.actionBadge}>Acessar Módulo →</Text>
            </TouchableOpacity>
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
  headerContainer: {
    backgroundColor: PRIMARY_DARK,
    paddingTop: 15,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTextGroup: { justifyContent: 'center' },
  brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  brandSubtitle: { color: ACCENT_GREEN },
  brandTagline: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginTop: -2 },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  logoutButtonText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600',
  },
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
  welcomeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 13,
    color: '#64748B',
    lineHeight: 18,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  menuCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 18,
    width: '48%',
    minWidth: 260,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    elevation: 2,
    justifyContent: 'space-between',
  },
  menuTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: PRIMARY_DARK,
    marginBottom: 6,
  },
  menuDescription: {
    fontSize: 12,
    color: '#64748B',
    lineHeight: 16,
    marginBottom: 14,
  },
  actionBadge: {
    fontSize: 12,
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