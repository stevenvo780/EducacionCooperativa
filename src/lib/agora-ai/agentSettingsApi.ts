import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * Configuración del agente que el backend lee desde `users/{uid}` en el campo
 * mapa `agentSettings`. El backend espera EXACTAMENTE estos nombres:
 *   { mainModel: string, auxModel: string, autonomousMode: boolean }
 *
 * Se guarda como campo mapa del doc del usuario (no como subcolección) para
 * que la regla Firestore `match /users/{userId}` ya vigente lo permita escribir
 * client-side con la auth del propio usuario, y el backend lo lea con el Admin
 * SDK vía `userDoc.data().agentSettings`.
 */
export interface AgentSettings {
  mainModel: string;
  auxModel: string;
  autonomousMode: boolean;
}

export const AGENT_SETTINGS_FIELD = 'agentSettings';

export const DEFAULT_AGENT_SETTINGS: AgentSettings = {
  mainModel: '',
  auxModel: '',
  autonomousMode: false
};

function normalizeAgentSettings(raw: unknown): AgentSettings {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_AGENT_SETTINGS };
  const r = raw as Record<string, unknown>;
  return {
    mainModel: typeof r['mainModel'] === 'string' ? r['mainModel'] : DEFAULT_AGENT_SETTINGS.mainModel,
    auxModel: typeof r['auxModel'] === 'string' ? r['auxModel'] : DEFAULT_AGENT_SETTINGS.auxModel,
    autonomousMode: typeof r['autonomousMode'] === 'boolean' ? r['autonomousMode'] : DEFAULT_AGENT_SETTINGS.autonomousMode
  };
}

export async function loadAgentSettings(uid: string): Promise<AgentSettings> {
  const ref = doc(db(), 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) return { ...DEFAULT_AGENT_SETTINGS };
  return normalizeAgentSettings(snap.data()?.[AGENT_SETTINGS_FIELD]);
}

/**
 * Persiste los cambios con merge — NO pisa otros campos del doc del usuario
 * (vault de API keys, claims, etc.). El `{ merge: true }` a nivel de doc + el
 * campo `agentSettings` como objeto completo evita borrar campos hermanos.
 */
export async function saveAgentSettings(uid: string, settings: AgentSettings): Promise<void> {
  const ref = doc(db(), 'users', uid);
  await setDoc(ref, { [AGENT_SETTINGS_FIELD]: normalizeAgentSettings(settings) }, { merge: true });
}
