import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

export default function TelaInicial({ onLogout }) {
  const menuItems = [
    { id: 'admin', titulo: 'Admin' },
    { id: 'templates', titulo: 'Templates' },
    { id: 'lancamentos', titulo: 'Lançamentos Diários' },
    { id: 'relatorios', titulo: 'Relatórios' },
  ];

  return (
    <ScrollView style={styles.container}>
      {/* Navbar Superior */}
      <View style={styles.navbar}>
        <View>
          <Text style={styles.logoText}>Animalia Cash</Text>
          <Text style={styles.subLogoText}>Clínica Veterinária Vida Animal</Text>
        </View>
        {onLogout && (
          <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutButtonText}>Sair</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.content}>
        {/* Banner de Boas-vindas */}
        <View style={styles.welcomeCard}>
          <Text style={styles.welcomeTitle}>Bem-vindo ao Animalia Cash</Text>
          <Text style={styles.welcomeSubtitle}>
            Selecione um dos módulos abaixo para gerir a sua clínica veterinária.
          </Text>
        </View>

        {/* Grelha de Botões dos Módulos */}
        <View style={styles.gridContainer}>
          {menuItems.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={styles.menuCard}
              activeOpacity={0.7}
            >
              <Text style={styles.menuTitle}>{item.titulo}</Text>
            </TouchableOpacity>
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
  welcomeCard: {
    backgroundColor: '#E2E8F0',
    borderRadius: 12,
    padding: 24,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#0F172A',
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#475569',
    marginTop: 4,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  menuCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 24,
    width: '48%',
    minWidth: 280,
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    justifyContent: 'center',
    minHeight: 100,
  },
  menuTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#0F172A',
  },
});