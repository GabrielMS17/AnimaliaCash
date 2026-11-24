import { Redirect } from 'expo-router';

// Custos e Taxas agora fica dentro do Resultado do mês
export default function Custos() {
  return <Redirect href="/resultado" />;
}
