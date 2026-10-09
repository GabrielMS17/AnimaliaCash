import { Link } from 'expo-router';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import AppHeader from '../../components/AppHeader';
import { useAnimaliaData } from '../../store/AnimaliaDataContext';

const menuItems = [
  { href: '/cirurgia', titulo: 'Cirurgias', descricao: 'Custo de cada cirurgia por peso, com insumos e terceirizados' },
  { href: '/internacao', titulo: 'Internação', descricao: 'Custo das diárias de internação por porte do animal' },
  { href: '/banho-tosa', titulo: 'Banho & Tosa', descricao: 'Custo de cada serviço de estética por porte' },
  { href: '/insumos', titulo: 'Insumos', descricao: 'Materiais e medicamentos com custo unitário' },
  { href: '/estoque', titulo: 'Estoque', descricao: 'Produtos, entrada de lotes e custo médio' },
  { href: '/configuracoes', titulo: 'Configurações', descricao: 'Clínica, terceirizados, comissões e sincronização' },
];

export default function TelaInicial() {
  const { settings } = useAnimaliaData();

  return (
    <View style={styles.mainWrapper}>
      <AppHeader />

      {/* Conteúdo Principal */}
      <ScrollView style={styles.container} contentContainerStyle={styles.contentPadding}>
        <View style={styles.pageHeader}>
          <Text style={styles.sectionTitle}>Painel Principal</Text>

          {/* Subtítulo Institucional / Nome da Clínica */}
          <Text style={styles.sectionSubtitle}>
            {settings.clinicName} — Visão Geral dos Módulos
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
            <Link key={item.href} href={item.href} asChild>
              <TouchableOpacity style={styles.menuCard} activeOpacity={0.7}>
                <Text style={styles.menuTitle}>{item.titulo}</Text>
                <Text style={styles.menuDescription}>{item.descricao}</Text>
                <Text style={styles.actionBadge}>Acessar Módulo →</Text>
              </TouchableOpacity>
            </Link>
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