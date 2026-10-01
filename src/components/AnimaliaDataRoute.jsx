import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AnimaliaLegacyDataPanel from './AnimaliaLegacyDataPanel';

export default function AnimaliaDataRoute({ view, category, title, route, goToLogin }) {
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

        {goToLogin && (
          <TouchableOpacity onPress={goToLogin} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        {title && (
          <View style={styles.pageHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
          </View>
        )}

        <AnimaliaLegacyDataPanel
          initialView={view}
          initialProcedureCategory={category}
          screenTitle={title}
          currentRoute={route}
        />

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