import { supabase } from './Supabase';

export async function cadastrarProduto({ nome, marca, tipo_fracionamento, estoque_minimo, vida_util_usos }) {
  const { data, error } = await supabase
    .from('produtos')
    .insert([
      {
        nome,
        marca,
        tipo_fracionamento,
        estoque_minimo: parseFloat(estoque_minimo) || 0,
        vida_util_usos: vida_util_usos ? parseInt(vida_util_usos) : 1,
      },
    ])
    .select();

  if (error) throw new Error(error.message);
  return data;  
}

export async function registrarEntradaLote({ produto_id, numero_lote, data_validade, quantidade_adquirida, valor_total_lote }) {
  const qtd = parseFloat(quantidade_adquirida);
  const valorTotal = parseFloat(valor_total_lote);
  const custoUnitario = valorTotal / qtd;

  const { data, error } = await supabase
    .from('lotes_compras')
    .insert([
      {
        produto_id,
        numero_lote,
        data_validade: data_validade || null,
        quantidade_adquirida: qtd,
        valor_total_lote: valorTotal,
        custo_por_unidade_lote: custoUnitario,
      },
    ])
    .select();

  if (error) throw new Error(error.message);
  return data;
}

export async function listarProdutos() {
  const { data, error } = await supabase
    .from('produtos')
    .select('*')
    .order('nome', { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function registrarPerda({ produto_id, quantidade_perdida, motivo, observacao }) {
  const { data, error } = await supabase
    .from('perdas_estoque')
    .insert([
      {
        produto_id,
        quantidade_perdida: parseFloat(quantidade_perdida),
        motivo,
        observacao,
      },
    ])
    .select();

  if (error) throw new Error(error.message);
  return data;
}