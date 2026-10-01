// Banco de dados em memória para testes sem Supabase
let produtosMock = [];

export async function cadastrarProduto({ nome, marca, tipo_fracionamento, estoque_minimo, vida_util_usos }) {
  const novoProduto = {
    id: String(Date.now()),
    nome,
    marca,
    tipo_fracionamento,
    estoque_minimo: parseFloat(estoque_minimo) || 0,
    vida_util_usos: vida_util_usos ? parseInt(vida_util_usos) : 1,
    saldo_estoque: 0,
    custo_medio_unitario: 0,
  };

  produtosMock.push(novoProduto);
  return [novoProduto];
}

export async function registrarEntradaLote({ produto_id, numero_lote, data_validade, quantidade_adquirida, valor_total_lote }) {
  const qtd = parseFloat(quantidade_adquirida);
  const valorTotal = parseFloat(valor_total_lote);
  const custoUnitario = valorTotal / qtd;

  const produto = produtosMock.find((p) => p.id === produto_id);
  if (produto) {
    produto.saldo_estoque = (produto.saldo_estoque || 0) + qtd;
    produto.custo_medio_unitario = custoUnitario;
  }

  const novoLote = {
    id: String(Date.now()),
    produto_id,
    numero_lote,
    data_validade: data_validade || null,
    quantidade_adquirida: qtd,
    valor_total_lote: valorTotal,
    custo_por_unidade_lote: custoUnitario,
  };

  return [novoLote];
}

export async function listarProdutos() {
  return [...produtosMock].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function registrarPerda({ produto_id, quantidade_perdida, motivo, observacao }) {
  const novaPerda = {
    id: String(Date.now()),
    produto_id,
    quantidade_perdida: parseFloat(quantidade_perdida),
    motivo,
    observacao,
  };

  return [novaPerda];
}