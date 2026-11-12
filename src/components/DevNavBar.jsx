import { Link, usePathname } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAnimaliaData } from '../store/AnimaliaDataContext';
import { canAccessRoute } from '../utils/accessControl';

const navItems = [
  { href: '/Login', label: 'Login' },
  { href: '/', label: 'Tela Inicial' },
  { href: '/estoque', label: 'Estoque' },
  { href: '/templates', label: 'Templates' },
  { href: '/custos', label: 'Custos e Taxas' },
  { href: '/cirurgia', label: 'Cirurgias' },
  { href: '/insumos', label: 'Insumos' },
  { href: '/internacao', label: 'Internação' },
  { href: '/banho-tosa', label: 'Banho & Tosa' },
  { href: '/configuracoes', label: 'Configurações' },
  { href: '/cadastros', label: 'Cadastros' },
];

// Barra de navegação rápida (Dev), exibida em todas as rotas pelo _layout
export default function DevNavBar() {
  const pathname = usePathname();
  const { session, role } = useAnimaliaData();
  const items = session
    ? navItems.filter((item) => item.href !== '/Login' && canAccessRoute(role, item.href))
    : navItems.filter((item) => item.href === '/Login');

  return (
    <View style={styles.devBarContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devBar}>
        <Text style={styles.devBarTitle}>Navegação (Dev):</Text>
        {items.map((item) => (
          <Link key={item.href} href={item.href} asChild>
            <TouchableOpacity
              style={StyleSheet.flatten([styles.devNavButton, pathname === item.href && styles.devNavActive])}
            >
              <Text style={styles.devNavText}>{item.label}</Text>
            </TouchableOpacity>
          </Link>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  devBarContainer: {
    backgroundColor: '#020617',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    zIndex: 9999,
  },
  devBar: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  devBarTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 'bold',
    marginRight: 4,
  },
  devNavButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 4,
    backgroundColor: '#1E293B',
  },
  devNavActive: {
    backgroundColor: '#10B981',
  },
  devNavText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
});
