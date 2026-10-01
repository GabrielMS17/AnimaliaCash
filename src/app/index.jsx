import { useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importação das Telas e Componentes
import AnimaliaDataRoute from '../components/AnimaliaDataRoute';
import CustosETaxasScreen from '../services/screens/CustosFixosTaxas';
import EstoqueScreen from '../services/screens/estoqueScreen';
import LoginScreen from '../services/screens/possivelLogin';
import TelaInicial from '../services/screens/TelaInicial';
import TemplatesScreen from '../services/screens/Templates';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState('login');
  const handleLogout = () => {
    setCurrentScreen('login');
  };

  return (
    <View style={{ flex: 1 }}>
      {/* Barra de Navegação Rápida (Dev) */}
      <ScreenSelector currentScreen={currentScreen} setCurrentScreen={setCurrentScreen} />

      {/* Renderização Condicional de Telas */}
      {currentScreen === 'login' && (
        <LoginScreen onLoginSuccess={() => setCurrentScreen('home')} />
      )}

      {currentScreen === 'home' && (
        <TelaInicial onLogout={handleLogout} />
      )}

      {currentScreen === 'estoque' && (
        <EstoqueScreen />
      )}

      {currentScreen === 'templates' && (
        <TemplatesScreen goToLogin={handleLogout} />
      )}

      {currentScreen === 'custos' && (
        <CustosETaxasScreen goToLogin={handleLogout} />
      )}

      {/* Rotas AnimaliaDataRoute */}
      {currentScreen === 'cirurgia' && (
        <AnimaliaDataRoute
          view="procedimentos"
          category="cirurgia"
          title="Cirurgias"
          route="/cirurgia"
          goToLogin={handleLogout}
        />
      )}

      {currentScreen === 'insumos' && (
        <AnimaliaDataRoute
          view="insumos"
          category="cirurgia"
          title="Insumos"
          route="/insumos"
          goToLogin={handleLogout}
        />
      )}

      {currentScreen === 'internacao' && (
        <AnimaliaDataRoute
          view="procedimentos"
          category="internacao"
          title="Internação"
          route="/internacao"
          goToLogin={handleLogout}
        />
      )}

      {currentScreen === 'banho_tosa' && (
        <AnimaliaDataRoute
          view="procedimentos"
          category="banho_tosa"
          title="Banho & Tosa"
          route="/banho-tosa"
          goToLogin={handleLogout}
        />
      )}

      {currentScreen === 'configuracoes' && (
        <AnimaliaDataRoute
          view="configuracoes"
          category="cirurgia"
          title="Configurações"
          route="/configuracoes"
          goToLogin={handleLogout}
        />
      )}
    </View>
  );
}

// Barra Dev atualizada com os botões para todas as rotas
function ScreenSelector({ currentScreen, setCurrentScreen }) {
  const navItems = [
    { id: 'login', label: 'Login' },
    { id: 'home', label: 'Tela Inicial' },
    { id: 'estoque', label: 'Estoque' },
    { id: 'templates', label: 'Templates' },
    { id: 'custos', label: 'Custos e Taxas' },
    { id: 'cirurgia', label: 'Cirurgias' },
    { id: 'insumos', label: 'Insumos' },
    { id: 'internacao', label: 'Internação' },
    { id: 'banho_tosa', label: 'Banho & Tosa' },
    { id: 'configuracoes', label: 'Configurações' },
  ];

  return (
    <View style={styles.devBarContainer}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.devBar}>
        <Text style={styles.devBarTitle}>Navegação (Dev):</Text>
        {navItems.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.devNavButton, currentScreen === item.id && styles.devNavActive]}
            onPress={() => setCurrentScreen(item.id)}
          >
            <Text style={styles.devNavText}>{item.label}</Text>
          </TouchableOpacity>
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