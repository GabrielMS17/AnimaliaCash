import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { initialInsumos, initialProcedures } from '../data/initialData';
import { normalizeProcedures, normalizeSettings, restoreMissingInsumos } from '../data/normalize';
import { readStorage, writeStorage } from './storage';

// Os dados ficam só neste navegador (localStorage). A versão web ainda não usa banco de dados.
const KEYS = {
  settings: 'animalia_web_settings',
  insumos: 'animalia_web_insumos',
  procedures: 'animalia_web_procedures',
  produtos: 'animalia_web_produtos',
};

const DataContext = createContext(null);

function buildState({ settings: savedSettings, insumos: savedInsumos, procedures: savedProcedures }) {
  const rawProcedures = savedProcedures ?? initialProcedures;
  const settings = normalizeSettings(savedSettings, rawProcedures);
  const procedures = normalizeProcedures(rawProcedures, settings);
  const insumos = restoreMissingInsumos(savedInsumos ?? initialInsumos, procedures);
  return { settings, insumos, procedures };
}

const upsertById = (list, saved) => {
  const index = list.findIndex((item) => item.id === saved.id);
  if (index < 0) return [saved, ...list];
  const next = [...list];
  next[index] = saved;
  return next;
};

export function DataProvider({ children }) {
  const [data, setData] = useState(() =>
    buildState({
      settings: readStorage(KEYS.settings),
      insumos: readStorage(KEYS.insumos),
      procedures: readStorage(KEYS.procedures),
    }),
  );
  const [produtos, setProdutos] = useState(() => readStorage(KEYS.produtos, []));

  useEffect(() => {
    writeStorage(KEYS.settings, data.settings);
    writeStorage(KEYS.insumos, data.insumos);
    writeStorage(KEYS.procedures, data.procedures);
  }, [data]);

  useEffect(() => {
    writeStorage(KEYS.produtos, produtos);
  }, [produtos]);

  const value = useMemo(() => ({
    ...data,
    produtos,
    insumosMap: new Map(data.insumos.map((insumo) => [insumo.id, insumo])),

    saveSettings: (settings) => setData((prev) => ({ ...prev, settings })),

    saveInsumo: (saved) => setData((prev) => ({ ...prev, insumos: upsertById(prev.insumos, saved) })),
    deleteInsumo: (id) => setData((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((insumo) => insumo.id !== id),
      procedures: prev.procedures.map((procedure) => ({
        ...procedure,
        items: procedure.items.filter((item) => item.insumoId !== id),
      })),
    })),

    saveProcedure: (saved) => setData((prev) => ({ ...prev, procedures: upsertById(prev.procedures, saved) })),
    duplicateProcedure: (procedure) => setData((prev) => ({
      ...prev,
      procedures: [
        {
          ...procedure,
          id: `proc_${Date.now()}`,
          name: `${procedure.name} (Cópia)`,
          items: procedure.items.map((item) => ({ ...item })),
        },
        ...prev.procedures,
      ],
    })),
    deleteProcedure: (id) => setData((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((procedure) => procedure.id !== id),
    })),

    resetData: () => setData((prev) => {
      const fresh = buildState({ settings: prev.settings });
      return { ...prev, insumos: fresh.insumos, procedures: fresh.procedures };
    }),

    addProduto: (produto) => setProdutos((prev) => [...prev, produto].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))),
    // Soma o lote ao saldo e recalcula o custo médio ponderado
    addLote: (produtoId, quantidade, valorTotal) => setProdutos((prev) => prev.map((produto) => {
      if (produto.id !== produtoId) return produto;
      const saldo = produto.saldo_estoque + quantidade;
      const custoAtual = produto.saldo_estoque * produto.custo_medio_unitario;
      return { ...produto, saldo_estoque: saldo, custo_medio_unitario: (custoAtual + valorTotal) / saldo };
    })),
  }), [data, produtos]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
