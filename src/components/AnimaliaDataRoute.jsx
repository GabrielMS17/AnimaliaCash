import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import ProceduresPage from './ProceduresPage';
import StockPage from './StockPage';
import SettingsPage from './SettingsPage';
import { AccentProvider, SECTIONS } from './ui';
import AppHeader from './AppHeader';
import CadastrosScreen from '../services/screens/cadastros';
import { supabase } from '../supabase';

/** Moldura compartilhada dos módulos de dados e do conteúdo da seção. */
export default function AnimaliaDataRoute({ section }) {
  const current = SECTIONS[section];
  const { loaded } = useAnimaliaData();

  return (
    <AccentProvider value={current}>
      <View style={styles.mainWrapper}>
        <AppHeader />

        {section === 'cadastros' ? (
          <CadastrosScreen supabaseClient={supabase} />
        ) : (
          <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
            <View style={styles.content}>
              {!loaded && <ActivityIndicator size="large" color={current.accent} style={{ marginTop: 40 }} />}
              {loaded && section === 'estoque' && <StockPage />}
              {loaded && section === 'configuracoes' && <SettingsPage />}
              {loaded && ['cirurgia', 'internacao', 'banho_tosa'].includes(section) && <ProceduresPage category={section} />}
            </View>

            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                © {new Date().getFullYear()} Animalia Cash — Soluções Financeiras
              </Text>
              <Text style={styles.footerSubtext}>Todos os direitos reservados.</Text>
            </View>
          </ScrollView>
        )}
      </View>
    </AccentProvider>
  );
}

const BG_LIGHT = '#F8FAFC';

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: BG_LIGHT },
  container: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
  footerContainer: {
    width: '100%',
    marginTop: 24,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    alignItems: 'center',
  },
  footerText: { width: '100%', fontSize: 11, lineHeight: 15, fontWeight: '600', color: '#64748B', textAlign: 'center' },
  footerSubtext: { width: '100%', fontSize: 10, lineHeight: 14, color: '#94A3B8', marginTop: 2, textAlign: 'center' },
});
