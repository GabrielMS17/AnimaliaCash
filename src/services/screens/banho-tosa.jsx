import AnimaliaDataRoute from '../../components/AnimaliaDataRoute';

// Tela de Banho & Tosa: custo de cada serviço de estética por porte do animal.
// A lista, os filtros e os formulários são compartilhados com Cirurgias e Internação: veja components/ProceduresPage.jsx.
export default function BanhoTosaScreen() {
  return <AnimaliaDataRoute section="banho_tosa" />;
}
