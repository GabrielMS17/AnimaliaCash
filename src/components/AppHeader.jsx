import { Link } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import UserMenu from './UserMenu';

/** Cabeçalho institucional usado em todas as telas: marca (leva à tela inicial) e avatar do usuário. */
export default function AppHeader() {
  return (
    <View style={styles.headerContainer}>
      <Link href="/" asChild>
        <Pressable accessibilityRole="link" accessibilityLabel="Ir para a tela inicial">
          <Text style={styles.brandTitle}>
            Animalia<Text style={styles.brandSubtitle}>Cash</Text>
          </Text>
          <Text style={styles.brandTagline}>SOLUÇÕES FINANCEIRAS</Text>
        </Pressable>
      </Link>
      <UserMenu />
    </View>
  );
}

const styles = StyleSheet.create({
  headerContainer: {
    backgroundColor: '#0C2D48',
    paddingTop: 15,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandTitle: { color: '#FFFFFF', fontSize: 20, fontWeight: '800', letterSpacing: 0.5 },
  brandSubtitle: { color: '#00A86B' },
  brandTagline: { color: '#94A3B8', fontSize: 9, fontWeight: '600', letterSpacing: 1.5, marginTop: -2 },
});
