import { Link, usePathname } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import UserMenu from './UserMenu';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { SECTIONS } from './ui';
import { ANIMAL_GROOMER_ROLE, canAccessRoute, VETERINARIAN_ROLE } from '../utils/accessControl';

const NAV_ORDER = [
  'cadastros',
  'custos',
  'estoque',
  'templates',
  'banho_tosa',
  'cirurgia',
  'internacao',
];

/** Cabeçalho institucional e navegação dos módulos permitidos para o perfil atual. */
export default function AppHeader() {
  const pathname = usePathname();
  const { role } = useAnimaliaData();
  const landingRoute = role === ANIMAL_GROOMER_ROLE
    ? '/banho-tosa'
    : role === VETERINARIAN_ROLE
      ? '/cirurgia'
      : '/cadastros';
  const navigationItems = NAV_ORDER
    .map((section) => SECTIONS[section])
    .filter((item) => canAccessRoute(role, item.href));

  return (
    <>
      <View style={styles.headerContainer}>
        <Link href={landingRoute} asChild>
          <Pressable
            accessibilityRole="link"
            accessibilityLabel="Ir para a tela inicial"
            style={styles.brand}
          >
            <Text style={styles.brandTitle} numberOfLines={1}>
              Animalia<Text style={styles.brandSubtitle}>Cash</Text>
            </Text>
            <Text style={styles.brandTagline} numberOfLines={1}>SOLUÇÕES FINANCEIRAS</Text>
          </Pressable>
        </Link>
        <UserMenu />
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.moduleNav}
        contentContainerStyle={styles.moduleNavContent}
      >
        {navigationItems.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <TouchableOpacity
              accessibilityRole="link"
              style={StyleSheet.flatten([
                styles.moduleLink,
                pathname === item.href && styles.moduleLinkActive,
              ])}
            >
              <Text style={[styles.moduleLinkText, pathname === item.href && styles.moduleLinkTextActive]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0C2D48',
    paddingTop: 15,
    paddingBottom: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  brand: { flexShrink: 1, minWidth: 0 },
  brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  brandSubtitle: { color: '#00A86B' },
  brandTagline: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginTop: -2, flexShrink: 1 },
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
  moduleLinkActive: { borderBottomColor: '#0C2D48' },
  moduleLinkText: { fontSize: 14, color: '#64748B', fontWeight: '500' },
  moduleLinkTextActive: { color: '#0C2D48', fontWeight: '700' },
});
