import { useState } from 'react';
import CustosETaxasScreen from './CustosFixosTaxas';
import LoginScreen from './Login';

export default function App() {
  // Estado para controlar qual ecra está ativo ('login' ou 'custos')
  const [currentScreen, setCurrentScreen] = useState('login');

  // Função chamada quando o login é efetuado com sucesso
  const handleLoginSuccess = () => {
    console.log('Login efetuado com sucesso! A navegar para Custos...');
    setCurrentScreen('custos');
  };

  // Função chamada para fazer logout e voltar ao login
  const handleLogout = () => {
    console.log('A terminar sessão...');
    setCurrentScreen('login');
  };

  // Renderização condicional dos ecrãs
  if (currentScreen === 'custos') {
    return <CustosETaxasScreen goToLogin={handleLogout} />;
  }

  return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
}