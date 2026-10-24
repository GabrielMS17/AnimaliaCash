import AnimaliaDataRoute from '../../components/AnimaliaDataRoute';

// Tela de Cirurgias: custo de cada cirurgia por peso, com insumos, terceirizados e comissão.
// A lista, os filtros e os formulários são compartilhados com Internação e Banho & Tosa: veja components/ProceduresPage.jsx.
export default function CirurgiaScreen() {
  return <AnimaliaDataRoute section="cirurgia" />;
}
