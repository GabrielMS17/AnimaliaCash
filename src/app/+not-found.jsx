import { Redirect } from 'expo-router';

// Endereço que não existe (ex: a antiga tela /insumos): volta para o início,
// e o _layout leva para a tela inicial do perfil logado.
export default function NotFound() {
  return <Redirect href="/" />;
}
