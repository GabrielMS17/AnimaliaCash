import { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

// Importação das Telas e Componentes
import AnimaliaDataRoute from '../components/AnimaliaDataRoute';
import CustosETaxasScreen from '../services/screens/CustosFixosTaxas';
import LoginScreen from '../services/screens/possivelLogin'; // Importa o seu componente real de login
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

      {currentScreen === 'templates' && (
        <TemplatesScreen goToLogin={handleLogout} />
      )}

      {currentScreen === 'custos' && (
        <CustosETaxasScreen goToLogin={handleLogout} />
      )}

      {/* Nova Rota: Cirurgia */}
      {currentScreen === 'cirurgia' && (
        <AnimaliaDataRoute
          view="procedimentos"
          category="cirurgia"
          title="Cirurgias"
          route="/cirurgia"
        />
      )}
    </View>
  );
}

// Barra Dev atualizada com o botão para Cirurgia
function ScreenSelector({ currentScreen, setCurrentScreen }) {
  return (
    <View style={styles.devBar}>
      <Text style={styles.devBarTitle}>Navegação (Dev):</Text>
      <TouchableOpacity
        style={[styles.devNavButton, currentScreen === 'login' && styles.devNavActive]}
        onPress={() => setCurrentScreen('login')}
      >
        <Text style={styles.devNavText}>Login</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.devNavButton, currentScreen === 'home' && styles.devNavActive]}
        onPress={() => setCurrentScreen('home')}
      >
        <Text style={styles.devNavText}>Tela Inicial</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.devNavButton, currentScreen === 'templates' && styles.devNavActive]}
        onPress={() => setCurrentScreen('templates')}
      >
        <Text style={styles.devNavText}>Templates</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.devNavButton, currentScreen === 'custos' && styles.devNavActive]}
        onPress={() => setCurrentScreen('custos')}
      >
        <Text style={styles.devNavText}>Custos e Taxas</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.devNavButton, currentScreen === 'cirurgia' && styles.devNavActive]}
        onPress={() => setCurrentScreen('cirurgia')}
      >
        <Text style={styles.devNavText}>Cirurgias</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  devBar: {
    backgroundColor: '#020617',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    flexWrap: 'wrap',
    zIndex: 9999,
  },
  devBarTitle: {
    color: '#64748B',
    fontSize: 12,
    fontWeight: 'bold',
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