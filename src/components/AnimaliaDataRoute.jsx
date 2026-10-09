import { Link } from 'expo-router';
import { ActivityIndicator, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import InsumosPage from './InsumosPage';
import ProceduresPage from './ProceduresPage';
import SettingsPage from './SettingsPage';
import { AccentProvider, SECTIONS } from './ui';
import AppHeader from './AppHeader';

const SECTION_ORDER = ['banho_tosa', 'cirurgia', 'internacao', 'insumos', 'configuracoes'];

/** Moldura dos módulos de custos: cabeçalho, navegação entre módulos e o conteúdo da seção. */
export default function AnimaliaDataRoute({ section }) {
  const current = SECTIONS[section];
  const { loaded } = useAnimaliaData();

  return (
    <AccentProvider value={current}>
      <View style={styles.mainWrapper}>
        <AppHeader />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.moduleNav} contentContainerStyle={styles.moduleNavContent}>
          {SECTION_ORDER.map((id) => {
            const item = SECTIONS[id];
            const active = id === section;
            return (
              <Link key={id} href={item.href} asChild>
                <TouchableOpacity style={StyleSheet.flatten([styles.moduleLink, active && { borderBottomColor: item.accent }])}>
                  <Text style={[styles.moduleLinkText, active && { color: PRIMARY_DARK, fontWeight: '700' }]}>{item.label}</Text>
                </TouchableOpacity>
              </Link>
            );
          })}
        </ScrollView>

        <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
          <View style={styles.content}>
            {!loaded && <ActivityIndicator size="large" color={current.accent} style={{ marginTop: 40 }} />}
            {loaded && section === 'insumos' && <InsumosPage />}
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
      </View>
    </AccentProvider>
  );
}

const PRIMARY_DARK = '#0C2D48';
const BG_LIGHT = '#F8FAFC';

const styles = StyleSheet.create({
  mainWrapper: { flex: 1, backgroundColor: BG_LIGHT },
  moduleNav: {
    flexGrow: 0,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  moduleNavContent: { paddingHorizontal: 12, gap: 4 },
  moduleLink: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  moduleLinkText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  container: { flex: 1 },
  contentPadding: { padding: 16, paddingBottom: 32 },
  content: { width: '100%', maxWidth: 1180, alignSelf: 'center' },
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
