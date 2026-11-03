import { Link } from 'react-router-dom';
import { useData } from '../store/DataContext';

const MODULES = [
  { to: '/cirurgia', title: 'Cirurgias', description: 'Custo de cada cirurgia por peso, com insumos e terceirizados' },
  { to: '/internacao', title: 'Internação', description: 'Custo das diárias de internação por porte do animal' },
  { to: '/banho-tosa', title: 'Banho & Tosa', description: 'Custo de cada serviço de estética por porte' },
  { to: '/insumos', title: 'Insumos', description: 'Materiais e medicamentos com custo unitário' },
  { to: '/estoque', title: 'Estoque', description: 'Produtos, entrada de lotes e custo médio' },
  { to: '/configuracoes', title: 'Configurações', description: 'Clínica, terceirizados e comissões' },
];

export default function Home() {
  const { settings } = useData();

  return (
    <>
      <div className="page-title">
        <h1>Painel Principal</h1>
        <p>{settings.clinicName} — Visão Geral dos Módulos</p>
      </div>

      <div className="card welcome">
        <h2>Bem-vindo ao Animalia Cash</h2>
        <p>Selecione um dos módulos abaixo para gerir a sua clínica veterinária, acompanhar relatórios e padronizar procedimentos.</p>
      </div>

      <div className="module-grid">
        {MODULES.map((item) => (
          <Link key={item.to} to={item.to} className="module-card">
            <h3>{item.title}</h3>
            <p>{item.description}</p>
            <span>Acessar Módulo →</span>
          </Link>
        ))}
      </div>
    </>
  );
}
