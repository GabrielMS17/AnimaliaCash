import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialInsumos, initialProcedures } from '../data/initialData';
import { normalizeProcedures, normalizeSettings, restoreMissingInsumos } from '../data/normalize';
import { pullAll, pushChanges, stateKey } from '../services/supabaseSync';
import { useAuth } from './AuthContext';
import { readStorage, writeStorage } from './storage';

// Os dados ficam salvos no navegador (localStorage). Com o usuário logado, cada alteração é enviada ao
// Supabase e o que foi gravado por outros é baixado: ao abrir, ao voltar para a guia e a cada minuto.
// A "base" é a última versão igual à do banco. O Estoque continua só no navegador, como no app.
const KEYS = {
  settings: 'animalia_web_settings',
  insumos: 'animalia_web_insumos',
  procedures: 'animalia_web_procedures',
  autoSync: 'animalia_web_autosync',
  syncBase: 'animalia_web_sync_base',
};

const AUTO_SYNC_DELAY_MS = 1500;
const REFRESH_INTERVAL_MS = 60000;

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
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [data, setData] = useState(() =>
    buildState({
      settings: readStorage(KEYS.settings),
      insumos: readStorage(KEYS.insumos),
      procedures: readStorage(KEYS.procedures),
    }),
  );
  const [autoSync, setAutoSyncState] = useState(() => readStorage(KEYS.autoSync, true));
  const [syncStatus, setSyncStatus] = useState({ state: 'idle' });
  // Conta alterações feitas pelo usuário; carregar ou baixar dados não dispara envio automático
  const [changeCount, setChangeCount] = useState(0);
  const dataRef = useRef(data);
  const baseRef = useRef(readStorage(KEYS.syncBase));
  const syncQueue = useRef(Promise.resolve());

  useEffect(() => {
    dataRef.current = data;
    writeStorage(KEYS.settings, data.settings);
    writeStorage(KEYS.insumos, data.insumos);
    writeStorage(KEYS.procedures, data.procedures);
  }, [data]);

  const update = useCallback((updater) => {
    setData(updater);
    setChangeCount((count) => count + 1);
  }, []);

  const rememberBase = useCallback((state) => {
    baseRef.current = state;
    writeStorage(KEYS.syncBase, state);
  }, []);

  /** Enfileira uma operação de sincronização: uma só começa depois que a anterior terminou. */
  const enqueue = useCallback((task, { quiet = false } = {}) => {
    const run = syncQueue.current.then(async () => {
      if (!quiet) setSyncStatus({ state: 'syncing' });
      try {
        const status = await task();
        if (status) setSyncStatus({ at: new Date(), ...status });
      } catch (error) {
        setSyncStatus({ state: 'error', message: error.message });
      }
    });
    syncQueue.current = run;
    return run;
  }, []);

  /** Envia o que mudou desde a última versão sincronizada. */
  const pushPending = useCallback(async () => {
    const local = dataRef.current;
    if (baseRef.current && stateKey(baseRef.current) === stateKey(local)) return false;
    await pushChanges(baseRef.current, local);
    rememberBase(local);
    return true;
  }, [rememberBase]);

  /** Traz os dados do banco para o navegador, sem atropelar uma edição feita durante a consulta. */
  const applyRemote = useCallback((remote, localBeforePull) => {
    const state = buildState({
      settings: remote.settings ?? localBeforePull.settings,
      insumos: remote.insumos,
      procedures: remote.procedures,
    });
    if (dataRef.current !== localBeforePull) return false;
    rememberBase(state);
    if (stateKey(state) !== stateKey(localBeforePull)) {
      dataRef.current = state;
      setData(state);
    }
    return true;
  }, [rememberBase]);

  const pushNow = useCallback(() => enqueue(async () => {
    await pushPending();
    return { state: 'ok', message: 'Dados enviados ao Supabase.' };
  }), [enqueue, pushPending]);

  // Garante que insumos e procedimentos recém-editados já estão no banco (o estoque depende deles).
  // Só envia se este navegador já sincronizou antes, para não subir dados de exemplo por engano.
  const flushPending = useCallback(() => enqueue(async () => {
    if (baseRef.current) await pushPending();
    return null;
  }, { quiet: true }), [enqueue, pushPending]);

  const pullNow = useCallback(() => enqueue(async () => {
    const local = dataRef.current;
    const remote = await pullAll();
    if (!remote) throw new Error('Ainda não há dados da clínica no Supabase. Envie os dados primeiro.');
    applyRemote(remote, local);
    return { state: 'ok', message: 'Dados baixados do Supabase.' };
  }), [enqueue, applyRemote]);

  // Envia o que estiver pendente e busca o que foi gravado por outros. Com o banco vazio, nada sobe
  // sozinho: o primeiro envio é manual, para dados de exemplo não irem para o banco por engano.
  const refresh = useCallback(() => enqueue(async () => {
    if (baseRef.current) await pushPending();
    const local = dataRef.current;
    const remote = await pullAll();
    if (!remote) {
      return baseRef.current
        ? null
        : { state: 'empty', message: 'O banco ainda não tem dados da clínica. Use "Enviar dados agora" para fazer o primeiro envio.' };
    }
    applyRemote(remote, local);
    return { state: 'ok', message: 'Dados atualizados com o Supabase.' };
  }, { quiet: true }), [enqueue, pushPending, applyRemote]);

  useEffect(() => {
    if (!userId || !autoSync) return undefined;
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [userId, autoSync, refresh]);

  useEffect(() => {
    if (changeCount === 0 || !autoSync || !userId || !baseRef.current) return undefined;
    const timer = setTimeout(pushNow, AUTO_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changeCount, autoSync, userId, pushNow]);

  const value = useMemo(() => ({
    ...data,
    insumosMap: new Map(data.insumos.map((insumo) => [insumo.id, insumo])),

    saveSettings: (settings) => update((prev) => ({ ...prev, settings })),

    saveProfessional: (saved) => update((prev) => {
      const professionals = prev.settings.externalProfessionals ?? [];
      return {
        ...prev,
        settings: {
          ...prev.settings,
          externalProfessionals: professionals.some((item) => item.id === saved.id)
            ? professionals.map((item) => (item.id === saved.id ? saved : item))
            : [...professionals, saved],
        },
      };
    }),
    deleteProfessional: (id) => update((prev) => ({
      ...prev,
      settings: {
        ...prev.settings,
        externalProfessionals: (prev.settings.externalProfessionals ?? []).filter((item) => item.id !== id),
      },
      procedures: prev.procedures.map((procedure) => {
        const assignments = (procedure.externalProfessionalAssignments ?? []).filter((item) => item.professionalId !== id);
        return { ...procedure, externalProfessionalAssignments: assignments.length > 0 ? assignments : undefined };
      }),
    })),

    saveInsumo: (saved) => update((prev) => ({ ...prev, insumos: upsertById(prev.insumos, saved) })),
    deleteInsumo: (id) => update((prev) => ({
      ...prev,
      insumos: prev.insumos.filter((insumo) => insumo.id !== id),
      procedures: prev.procedures.map((procedure) => ({
        ...procedure,
        items: procedure.items.filter((item) => item.insumoId !== id),
      })),
    })),

    saveProcedure: (saved) => update((prev) => ({ ...prev, procedures: upsertById(prev.procedures, saved) })),
    duplicateProcedure: (procedure) => update((prev) => ({
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
    deleteProcedure: (id) => update((prev) => ({
      ...prev,
      procedures: prev.procedures.filter((procedure) => procedure.id !== id),
    })),

    resetData: () => update((prev) => {
      const fresh = buildState({ settings: prev.settings });
      return { ...prev, insumos: fresh.insumos, procedures: fresh.procedures };
    }),

    autoSync,
    setAutoSync: (enabled) => {
      setAutoSyncState(enabled);
      writeStorage(KEYS.autoSync, enabled);
    },
    syncStatus,
    pushNow,
    pullNow,
    flushPending,
  }), [data, autoSync, syncStatus, update, pushNow, pullNow, flushPending]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}
