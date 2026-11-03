import { useState } from 'react';
import { Field, NumberInput, Segmented } from '../components/ui';
import { useData } from '../store/DataContext';

const TIPOS = [
  { value: 'ML', label: 'Líquido (ML)' },
  { value: 'UNIDADE', label: 'Unidade / Peça' },
];

export default function Estoque() {
  const { produtos, addProduto, addLote } = useData();

  const [nome, setNome] = useState('');
  const [marca, setMarca] = useState('');
  const [tipo, setTipo] = useState('ML');
  const [estoqueMinimo, setEstoqueMinimo] = useState(0);
  const [produtoMsg, setProdutoMsg] = useState(null);

  const [produtoId, setProdutoId] = useState('');
  const [numeroLote, setNumeroLote] = useState('');
  const [quantidade, setQuantidade] = useState(0);
  const [valorTotal, setValorTotal] = useState(0);
  const [loteMsg, setLoteMsg] = useState(null);

  const selecionado = produtoId || produtos[0]?.id || '';

  const cadastrarProduto = (event) => {
    event.preventDefault();
    if (!nome.trim()) {
      setProdutoMsg({ error: true, text: 'Informe o nome do produto.' });
      return;
    }
    addProduto({
      id: String(Date.now()),
      nome: nome.trim(),
      marca: marca.trim(),
      tipo_fracionamento: tipo,
      estoque_minimo: estoqueMinimo,
      saldo_estoque: 0,
      custo_medio_unitario: 0,
    });
    setProdutoMsg({ text: 'Produto cadastrado!' });
    setNome('');
    setMarca('');
    setEstoqueMinimo(0);
  };

  const registrarLote = (event) => {
    event.preventDefault();
    if (!selecionado || quantidade <= 0 || valorTotal <= 0) {
      setLoteMsg({ error: true, text: 'Selecione um produto e preencha a quantidade e o valor total.' });
      return;
    }
    addLote(selecionado, quantidade, valorTotal);
    setLoteMsg({ text: 'Lote registrado e custo médio recalculado!' });
    setNumeroLote('');
    setQuantidade(0);
    setValorTotal(0);
  };

  return (
    <>
      <div className="page-title">
        <h1>Gestão de Estoque</h1>
      </div>

      <form className="card form-group" onSubmit={cadastrarProduto} noValidate>
        <h2>1. Novo Produto / Insumo</h2>
        <Field label="Nome do Item">
          <input type="text" placeholder="Ex: Anestésico X, Seringa 5ml..." value={nome} onChange={(event) => setNome(event.target.value)} />
        </Field>
        <Field label="Marca / Fabricante">
          <input type="text" placeholder="Ex: Zoetis, Ourofino..." value={marca} onChange={(event) => setMarca(event.target.value)} />
        </Field>
        <div className="field">
          <span className="field-label">Tipo de Fracionamento</span>
          <Segmented label="Tipo de fracionamento" options={TIPOS} value={tipo} onChange={setTipo} />
        </div>
        <Field label="Estoque Mínimo Alerta">
          <NumberInput min={0} placeholder="Ex: 10" value={estoqueMinimo} onChange={setEstoqueMinimo} />
        </Field>
        {produtoMsg && <p className={produtoMsg.error ? 'error-text' : 'saved-text'} role="status">{produtoMsg.text}</p>}
        <button type="submit" className="btn btn-primary">Cadastrar Produto</button>
      </form>

      <form className="card form-group" onSubmit={registrarLote} noValidate>
        <h2>2. Dar Entrada em Compra (Lote)</h2>
        <Field label="Selecione o Produto">
          <select value={selecionado} onChange={(event) => setProdutoId(event.target.value)} disabled={produtos.length === 0}>
            {produtos.length === 0 && <option value="">Cadastre um produto primeiro</option>}
            {produtos.map((produto) => <option key={produto.id} value={produto.id}>{produto.nome}</option>)}
          </select>
        </Field>
        <Field label="Número do Lote">
          <input type="text" placeholder="Ex: LOTE-2026-X" value={numeroLote} onChange={(event) => setNumeroLote(event.target.value)} />
        </Field>
        <Field label="Quantidade Adquirida">
          <NumberInput min={0} placeholder="Ex: 50" value={quantidade} onChange={setQuantidade} />
        </Field>
        <Field label="Valor Total Pago (R$)">
          <NumberInput prefix="R$" min={0} placeholder="Ex: 250,00" value={valorTotal} onChange={setValorTotal} />
        </Field>
        {loteMsg && <p className={loteMsg.error ? 'error-text' : 'saved-text'} role="status">{loteMsg.text}</p>}
        <button type="submit" className="btn btn-dark" disabled={!selecionado}>Registrar Lote e Recalcular Custo</button>
      </form>

      <div className="card">
        <h2>3. Insumos Cadastrados</h2>
        {produtos.length === 0 ? (
          <p className="empty-text">Nenhum produto cadastrado no sistema.</p>
        ) : (
          produtos.map((produto) => (
            <div key={produto.id} className="product-item">
              <div className="product-head">
                <strong>{produto.nome}</strong>
                <span className="badge">{produto.tipo_fracionamento}</span>
              </div>
              <div className="product-info">
                <span>Saldo Atual: <b>{produto.saldo_estoque}</b> {produto.tipo_fracionamento}</span>
                <span>Custo Médio: <b>R$ {Number(produto.custo_medio_unitario).toFixed(4).replace('.', ',')}</b></span>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}
