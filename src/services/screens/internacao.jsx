import AnimaliaDataRoute from '../../components/AnimaliaDataRoute';

// Tela de Internação: custo das diárias de internação por porte do animal.
// A lista, os filtros e os formulários são compartilhados com Cirurgias e Banho & Tosa: veja components/ProceduresPage.jsx.
export default function InternacaoScreen() {
  return <AnimaliaDataRoute section="internacao" />;
}
