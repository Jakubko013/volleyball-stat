import type { Match, Player } from './types';

const MATCHES_KEY = 'vs:matches';
const ROSTERS_KEY = 'vs:rosters';

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const loadMatches = (): Match[] => read<Match[]>(MATCHES_KEY, []);
export const saveMatches = (matches: Match[]): boolean => write(MATCHES_KEY, matches);

export interface SavedRoster {
  team: string;
  players: Player[];
  savedAt: number;
}

export const loadRosters = (): SavedRoster[] => read<SavedRoster[]>(ROSTERS_KEY, []);

/** Uloží soupisku pro offline použití (přepíše starší soupisku stejného týmu). */
export function saveRoster(team: string, players: Player[]): void {
  const others = loadRosters().filter((r) => r.team !== team);
  write(ROSTERS_KEY, [{ team, players, savedAt: Date.now() }, ...others].slice(0, 20));
}

/** Požádá prohlížeč, aby data nemazal při nedostatku místa (hlavně iOS/Safari). */
export function requestPersistentStorage(): void {
  navigator.storage?.persist?.().catch(() => undefined);
}

export function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}
