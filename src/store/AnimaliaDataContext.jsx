import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { initialInsumos, initialProcedures } from '../data/initialData';
import { normalizeProcedures, normalizeSettings, restoreMissingInsumos } from '../data/normalize';
import { pullAll, pushAll } from '../services/supabaseSync';
import { supabase } from '../supabase';

// Os dados ficam salvos no dispositivo (localStorage na web, AsyncStorage no celular)
// e, com o usuário logado, são enviados ao Supabase a cada alteração.
const KEYS = {
  settings: 'animalia_settings_v1',
  insumos: 'animalia_insumos_v1',
  procedures: 'animalia_procedures_v1',
  autoSync: 'animalia_autosync_v1',
  syncOwner: 'animalia_sync_owner_v1',
};

const AUTO_SYNC_DELAY_MS = 1500;

const AnimaliaDataContext = createContext(null);

async function readJson(key) {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

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

export function AnimaliaDataProvider({ children }) {
  const [loaded, setLoaded] = useState(false);
  const [data, setData] = useState(() => buildState({}));
  const [session, setSession] = useState(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [autoSync, setAutoSyncState] = useState(true);
  // Conta cujos dados estão neste dispositivo. Enquanto não bater com a conta logada, nada é enviado
  // automaticamente, para não sobrescrever no Supabase os dados que a conta já tem.
  const [syncOwner, setSyncOwner] = useState(null);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle' });
  // Conta alterações feitas pelo usuário; carregar ou baixar dados não dispara envio automático
  const [changeCount, setChangeCount] = useState(0);
  const dataRef = useRef(data);
  const syncQueue = useRef(Promise.resolve());
  const reconcilingFor = useRef(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const userId = session?.user?.id ?? null;

  useEffect(() => {
    (async () => {
      const [settings, insumos, procedures, savedAutoSync, savedOwner] = await Promise.all([
        readJson(KEYS.settings),
        readJson(KEYS.insumos),
        readJson(KEYS.procedures),
        readJson(KEYS.autoSync),
        readJson(KEYS.syncOwner),
      ]);
      setData(buildState({ settings, insumos, procedures }));
      if (savedAutoSync !== null) setAutoSyncState(savedAutoSync);
      setSyncOwner(savedOwner);
      setLoaded(true);
    })();

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setSessionLoaded(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.multiSet([
      [KEYS.settings, JSON.stringify(data.settings)],
      [KEYS.insumos, JSON.stringify(data.insumos)],
      [KEYS.procedures, JSON.stringify(data.procedures)],
    ]).catch((error) => console.error('Erro ao salvar dados locais:', error));
  }, [data, loaded]);

  const update = useCallback((updater) => {
    setData(updater);
    setChangeCount((count) => count + 1);
  }, []);

  const rememberOwner = useCallback((ownerId) => {
    setSyncOwner(ownerId);
    AsyncStorage.setItem(KEYS.syncOwner, JSON.stringify(ownerId)).catch(() => {});
  }, []);

  const applyRemote = useCallback((remote) => {
    setData(buildState({
      settings: remote.settings ?? dataRef.current.settings,
      insumos: remote.insumos,
      procedures: remote.procedures,
    }));
  }, []);

  /** Enfileira uma operação de sincronização: uma só começa depois que a anterior terminou. */
  const enqueue = useCallback((task) => {
    const run = syncQueue.current.then(async () => {
      setSyncStatus({ state: 'syncing' });
      try {
        const message = await task();
        if (message) setSyncStatus({ state: 'ok', message, at: new Date() });
      } catch (error) {
        setSyncStatus({ state: 'error', message: error.message });
      }
    });
    syncQueue.current = run;
    return run;
  }, []);

  const pushNow = useCallback(() => enqueue(async () => {
    const ownerId = await pushAll(dataRef.current);
    rememberOwner(ownerId);
    return 'Dados enviados ao Supabase.';
  }), [enqueue, rememberOwner]);

  const pullNow = useCallback(() => enqueue(async () => {
    const remote = await pullAll();
    if (!remote) throw new Error('Ainda não há dados desta conta no Supabase. Envie os dados primeiro.');
    applyRemote(remote);
    rememberOwner(remote.ownerId);
    return 'Dados baixados do Supabase.';
  }), [enqueue, applyRemote, rememberOwner]);

  // Ao entrar com uma conta diferente da última sincronizada: carrega os dados que ela já tem no
  // Supabase; se ela ainda não tiver nada, faz o primeiro envio com os dados deste dispositivo.
  useEffect(() => {
    if (!loaded || !userId || userId === syncOwner || reconcilingFor.current === userId) return;
    reconcilingFor.current = userId;
    enqueue(async () => {
      try {
        const remote = await pullAll();
        if (remote) {
          applyRemote(remote);
          rememberOwner(remote.ownerId);
          return 'Dados desta conta carregados do Supabase.';
        }
        rememberOwner(await pushAll(dataRef.current));
        return 'Primeiro envio desta conta para o Supabase concluído.';
      } catch (error) {
        reconcilingFor.current = null; // permite tentar de novo no próximo login
        throw error;
      }
    });
  }, [loaded, userId, syncOwner, enqueue, applyRemote, rememberOwner]);

  useEffect(() => {
    if (changeCount === 0 || !autoSync || !userId || userId !== syncOwner) return;
    const timer = setTimeout(pushNow, AUTO_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changeCount, autoSync, userId, syncOwner, pushNow]);

  const value = useMemo(() => {
    const { settings, insumos, procedures } = data;
    return {
      loaded,
      settings,
      insumos,
      procedures,
      insumosMap: new Map(insumos.map((insumo) => [insumo.id, insumo])),

      saveSettings: (next) => update((prev) => ({ ...prev, settings: next })),

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

      session,
      sessionLoaded,
      autoSync,
      setAutoSync: (enabled) => {
        setAutoSyncState(enabled);
        AsyncStorage.setItem(KEYS.autoSync, JSON.stringify(enabled)).catch(() => {});
      },
      syncStatus,
      pushNow,
      pullNow,
    };
  }, [data, loaded, session, sessionLoaded, autoSync, syncStatus, update, pushNow, pullNow]);

  return <AnimaliaDataContext.Provider value={value}>{children}</AnimaliaDataContext.Provider>;
}

export function useAnimaliaData() {
  const context = useContext(AnimaliaDataContext);
  if (!context) throw new Error('useAnimaliaData precisa estar dentro de AnimaliaDataProvider');
  return context;
}
