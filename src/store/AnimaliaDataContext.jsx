import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { initialInsumos, initialProcedures } from '../data/initialData';
import { normalizeProcedures, normalizeSettings, restoreMissingInsumos } from '../data/normalize';
import { pullAll, pushChanges, stateKey } from '../services/supabaseSync';
import { supabase } from '../supabase';

// Os dados ficam salvos no dispositivo (localStorage na web, AsyncStorage no celular). Com o usuário
// logado, cada alteração é enviada ao Supabase e o que foi gravado por outros é baixado: ao abrir,
// ao voltar para o app e a cada minuto. A "base" é a última versão igual à do banco.
const KEYS = {
  settings: 'animalia_settings_v1',
  insumos: 'animalia_insumos_v1',
  procedures: 'animalia_procedures_v1',
  autoSync: 'animalia_autosync_v1',
  syncBase: 'animalia_sync_base_v2',
};

const AUTO_SYNC_DELAY_MS = 1500;
const REFRESH_INTERVAL_MS = 60000;

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
  const [profileRole, setProfileRole] = useState(null);
  const [profileRoleLoaded, setProfileRoleLoaded] = useState(false);
  const [profileRoleUserId, setProfileRoleUserId] = useState(null);
  const [autoSync, setAutoSyncState] = useState(true);
  const [syncStatus, setSyncStatus] = useState({ state: 'idle' });
  // Conta alterações feitas pelo usuário; carregar ou baixar dados não dispara envio automático
  const [changeCount, setChangeCount] = useState(0);
  const dataRef = useRef(data);
  const syncQueue = useRef(Promise.resolve());
  const baseRef = useRef(null);
  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  const userId = session?.user?.id ?? null;
  const sessionMetadataRole = session?.user?.user_metadata?.role ?? null;

  useEffect(() => {
    (async () => {
      const [settings, insumos, procedures, savedAutoSync, savedBase] = await Promise.all([
        readJson(KEYS.settings),
        readJson(KEYS.insumos),
        readJson(KEYS.procedures),
        readJson(KEYS.autoSync),
        readJson(KEYS.syncBase),
      ]);
      setData(buildState({ settings, insumos, procedures }));
      if (savedAutoSync !== null) setAutoSyncState(savedAutoSync);
      baseRef.current = savedBase;
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
    if (!sessionLoaded) return undefined;
    if (!userId) {
      setProfileRole(null);
      setProfileRoleUserId(null);
      setProfileRoleLoaded(true);
      return undefined;
    }

    let active = true;
    setProfileRoleLoaded(false);

    const loadProfileRole = async () => {
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', userId)
          .maybeSingle();

        if (error) throw error;
        if (active) setProfileRole(profile?.role ?? sessionMetadataRole ?? 'Veterinário');
      } catch (error) {
        console.error('Erro ao carregar o perfil de acesso:', error);
        if (active) setProfileRole(sessionMetadataRole ?? 'Veterinário');
      } finally {
        if (active) {
          setProfileRoleUserId(userId);
          setProfileRoleLoaded(true);
        }
      }
    };

    loadProfileRole();
    return () => {
      active = false;
    };
  }, [userId, sessionLoaded, sessionMetadataRole]);

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

  const rememberBase = useCallback((state) => {
    baseRef.current = state;
    AsyncStorage.setItem(KEYS.syncBase, JSON.stringify(state)).catch(() => {});
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

  /** Traz os dados do banco para o dispositivo, sem atropelar uma edição feita durante a consulta. */
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
  // Só envia se o dispositivo já sincronizou antes, para não subir dados de exemplo por engano.
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
    if (!loaded || !userId || !autoSync) return;
    refresh();
    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, [loaded, userId, autoSync, refresh]);

  useEffect(() => {
    if (changeCount === 0 || !autoSync || !userId || !baseRef.current) return;
    const timer = setTimeout(pushNow, AUTO_SYNC_DELAY_MS);
    return () => clearTimeout(timer);
  }, [changeCount, autoSync, userId, pushNow]);

  const value = useMemo(() => {
    const { settings, insumos, procedures } = data;
    return {
      loaded,
      settings,
      insumos,
      procedures,
      insumosMap: new Map(insumos.map((insumo) => [insumo.id, insumo])),

      saveSettings: (next) => update((prev) => ({ ...prev, settings: next })),

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

      session,
      sessionLoaded,
      role: profileRole,
      roleLoaded: profileRoleLoaded,
      roleUserId: profileRoleUserId,
      autoSync,
      setAutoSync: (enabled) => {
        setAutoSyncState(enabled);
        AsyncStorage.setItem(KEYS.autoSync, JSON.stringify(enabled)).catch(() => {});
      },
      syncStatus,
      pushNow,
      pullNow,
      flushPending,
    };
  }, [data, loaded, session, sessionLoaded, profileRole, profileRoleLoaded, profileRoleUserId, autoSync, syncStatus, update, pushNow, pullNow, flushPending]);

  return <AnimaliaDataContext.Provider value={value}>{children}</AnimaliaDataContext.Provider>;
}

export function useAnimaliaData() {
  const context = useContext(AnimaliaDataContext);
  if (!context) throw new Error('useAnimaliaData precisa estar dentro de AnimaliaDataProvider');
  return context;
}
