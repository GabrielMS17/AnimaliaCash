import { useState } from 'react';
import { Segmented } from '../components/ui';

// Dados de exemplo, iguais aos da tela do app (o cadastro de templates ainda não existe)
const TEMPLATES = [
  { id: '1', nome: 'Banho Porte P', categoria: 'Estética', tempoEstimado: '45 min', insumosCount: 4 },
  { id: '2', nome: 'Castração Felina', categoria: 'Cirúrgico', tempoEstimado: '60 min', insumosCount: 5 },
  { id: '3', nome: 'Banho e Tosa Higiênica Porte M', categoria: 'Estética', tempoEstimado: '60 min', insumosCount: 4 },
  { id: '4', nome: 'Profilaxia Dental', categoria: 'Clínico', tempoEstimado: '90 min', insumosCount: 4 },
  { id: '5', nome: 'Vacinação Múltipla (V10)', categoria: 'Clínico', tempoEstimado: '15 min', insumosCount: 3 },
];

const TABS = [
  { value: 'Todos', label: 'Todos' },
  { value: 'Estética', label: 'Estética' },
  { value: 'Cirúrgico', label: 'Cirúrgicos' },
  { value: 'Clínico', label: 'Clínicos' },
];

export default function Templates() {
  const [tab, setTab] = useState('Todos');
  const visiveis = TEMPLATES.filter((item) => tab === 'Todos' || item.categoria === tab);

  return (
    <>
      <div className="page-title">
        <h1>Templates e Fichas Técnicas</h1>
        <p>Pré-configure insumos médios consumidos por procedimento para padronizar custos e lançamentos.</p>
      </div>

      <div className="card metric">
        <div>
          <strong>Templates de Serviços Ativos</strong>
          <small>Padronização de consumo e agilidade na operação diária</small>
        </div>
        <b>{TEMPLATES.length} ativos</b>
      </div>

      <button type="button" className="btn btn-primary btn-block" disabled title="Ainda não disponível">+ Criar Novo Template</button>

      <Segmented label="Filtrar por categoria" options={TABS} value={tab} onChange={setTab} />

      <div className="card table-card">
        <h2>Procedimentos Padronizados</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Nome do Procedimento</th>
                <th>Categoria</th>
                <th className="center">Insumos</th>
                <th className="right">Tempo Est.</th>
              </tr>
            </thead>
            <tbody>
              {visiveis.map((item) => (
                <tr key={item.id}>
                  <td><strong>{item.nome}</strong></td>
                  <td>{item.categoria}</td>
                  <td className="center">{item.insumosCount} itens</td>
                  <td className="right accent-text">{item.tempoEstimado}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
