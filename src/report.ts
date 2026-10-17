import type { Match, Player, Side } from './types';
import {
  countByPlayer,
  emptyCounts,
  setScores,
  setsWon,
  sumCounts,
  teamName,
  teamPlayers,
  toStats,
  type PlayerStats,
  type SetScore,
} from './stats';

/** Sloupce statistické tabulky – sdílí je obrazovka, export do schránky/CSV i PDF. */
export interface Col {
  group: string;
  label: string;
  get: (s: PlayerStats) => number | null;
  pct?: boolean;
}

export const COLS: Col[] = [
  { group: 'Body', label: 'Celk.', get: (s) => s.points },
  { group: 'Body', label: 'Chyby', get: (s) => s.errors },
  { group: 'Body', label: '+/−', get: (s) => s.plusMinus },
  { group: 'Podání', label: 'Celk.', get: (s) => s.srvTot },
  { group: 'Podání', label: 'Chyby', get: (s) => s.srvErr },
  { group: 'Podání', label: 'Esa', get: (s) => s.srvAce },
  { group: 'Přihrávka', label: 'Celk.', get: (s) => s.rcvTot },
  { group: 'Přihrávka', label: 'Chyby', get: (s) => s.rcvErr },
  { group: 'Útok', label: 'Celk.', get: (s) => s.atkTot },
  { group: 'Útok', label: 'Chyby', get: (s) => s.atkErr },
  { group: 'Útok', label: 'Zabl.', get: (s) => s.atkBlocked },
  { group: 'Útok', label: 'Body', get: (s) => s.atkKill },
  { group: 'Útok', label: 'Úsp.', get: (s) => s.atkPct, pct: true },
  { group: 'Blok', label: 'Body', get: (s) => s.blk },
];

export const GROUPS = COLS.reduce<{ name: string; span: number }[]>((acc, c) => {
  if (acc.at(-1)?.name === c.group) acc.at(-1)!.span++;
  else acc.push({ name: c.group, span: 1 });
  return acc;
}, []);

export const fmt = (v: number | null, col: Col) =>
  !v ? '–' : col.pct ? `${v} %` : col.label === '+/−' && v > 0 ? `+${v}` : String(v);

export interface TeamReport {
  side: Side;
  name: string;
  rows: { player: Player; stats: PlayerStats }[];
  total: PlayerStats;
}

export interface Report {
  match: Match;
  /** 0 = celý zápas, jinak číslo setu. */
  set: number;
  scores: SetScore[];
  won: SetScore;
  /** Náš tým, případně i soupeř (když se zapisuje). */
  teams: TeamReport[];
  /** Body bez určení hráče: chyby soupeře (pro nás) a body soupeře. */
  oppErr: number;
  oppPoint: number;
}

export function buildReport(match: Match, set: number): Report {
  const counts = countByPlayer(match.events, set || undefined);
  const inSet = match.events.filter((e) => !set || e.set === set);
  const sides: Side[] = match.oppPlayers.length ? ['us', 'them'] : ['us'];
  return {
    match,
    set,
    scores: setScores(match),
    won: setsWon(match),
    teams: sides.map((side) => {
      const players = [...teamPlayers(match, side)].sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));
      const playerCounts = players.map((p) => counts.get(p.id) ?? emptyCounts());
      return {
        side,
        name: teamName(match, side),
        rows: players.map((player, i) => ({ player, stats: toStats(playerCounts[i]) })),
        total: toStats(sumCounts(playerCounts)),
      };
    }),
    oppErr: inSet.filter((e) => e.type === 'oppErr').length,
    oppPoint: inSet.filter((e) => e.type === 'oppPoint').length,
  };
}

export const setLabel = (set: number) => (set ? `${set}. set` : 'Celý zápas');

export const reportTitle = (r: Report) => `${r.match.team} – ${r.match.opponent}`;

/** Název souboru bez diakritiky – prohlížeče jinak název s diakritikou zahodí („download“). */
export function reportFileName(r: Report): string {
  const part = r.set ? `-${r.set}set` : '';
  return `statistika-${r.match.date}-${r.match.team}-${r.match.opponent}${part}`
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Za-z\d-]+/g, '_');
}

/** Tabulka jako text (TSV pro schránku, CSV se středníkem pro Excel); každý tým má vlastní blok. */
export function reportToTable(r: Report, sep: string): string {
  const esc = (v: string) => (v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
  const head = ['Číslo', 'Hráč', ...COLS.map((c) => `${c.group} ${c.label}`)];
  return r.teams
    .map((t) => {
      const body = t.rows.map(({ player, stats }) => [player.number, player.name, ...COLS.map((c) => String(c.get(stats) ?? ''))]);
      const foot = ['', 'Celkem', ...COLS.map((c) => String(c.get(t.total) ?? ''))];
      return [[t.name], head, ...body, foot].map((row) => row.map(esc).join(sep)).join('\r\n');
    })
    .join('\r\n\r\n');
}
