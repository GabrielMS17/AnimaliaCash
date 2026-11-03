import { useState } from 'react';
import { Segmented } from '../components/ui';

// Dados de exemplo, iguais aos da tela do app (o cadastro de custos e taxas ainda não existe)
const CUSTOS_FIXOS = [
  { id: '1', nome: 'Aluguel do Imóvel', categoria: 'Estrutura', valor: 'R$ 4.500,00' },
  { id: '2', nome: 'Energia Elétrica', categoria: 'Utilidades', valor: 'R$ 1.200,00' },
  { id: '3', nome: 'Folha Salarial Fixa', categoria: 'Pessoal', valor: 'R$ 12.800,00' },
  { id: '4', nome: 'Serviços Contábeis', categoria: 'Administrativo', valor: 'R$ 850,00' },
];

const TAXAS = [
  { id: '1', bandeira: 'PIX', forma: 'À vista / Instantâneo', taxa: '0,99%' },
  { id: '2', bandeira: 'Cartão de Débito', forma: 'Débito', taxa: '1,49%' },
  { id: '3', bandeira: 'Cartão de Crédito', forma: 'Crédito à vista', taxa: '3,19%' },
  { id: '4', bandeira: 'Cartão de Crédito', forma: 'Crédito Parcelado (2x a 6x)', taxa: '4,89%' },
];

const TABS = [
  { value: 'custos', label: 'Custos Fixos Mensais' },
  { value: 'taxas', label: 'Taxas de Meios de Pagamento' },
];

export default function Custos() {
  const [tab, setTab] = useState('custos');

  return (
    <>
      <div className="page-title">
        <h1>Custos Fixos e Taxas</h1>
        <p>Gerencie custos operacionais, cálculo de hora/sala e taxas de meios de pagamento.</p>
      </div>

      <div className="card metric">
        <div>
          <strong>Hora/Sala Operacional Calculada</strong>
          <small>Baseado na estrutura e custos fixos mensais cadastrados</small>
        </div>
        <b>R$ 42,50 / h</b>
      </div>

      <button type="button" className="btn btn-primary btn-block" disabled title="Ainda não disponível">
        {tab === 'custos' ? '+ Novo Custo Fixo' : '+ Nova Taxa'}
      </button>

      <Segmented label="Tipo de cadastro" options={TABS} value={tab} onChange={setTab} />

      <div className="card table-card">
        <h2>{tab === 'custos' ? 'Custos Fixos Cadastrados' : 'Taxas de Pagamento Cadastradas'}</h2>
        <div className="table-scroll">
          {tab === 'custos' ? (
            <table>
              <thead>
                <tr><th>Nome / Descrição</th><th>Categoria</th><th className="right">Valor Mensal</th></tr>
              </thead>
              <tbody>
                {CUSTOS_FIXOS.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.nome}</strong></td>
                    <td>{item.categoria}</td>
                    <td className="right"><strong>{item.valor}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead>
                <tr><th>Meio / Bandeira</th><th>Forma de Pagamento</th><th className="right">Taxa (%)</th></tr>
              </thead>
              <tbody>
                {TAXAS.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.bandeira}</strong></td>
                    <td>{item.forma}</td>
                    <td className="right accent-text">{item.taxa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
