import { useMemo, useState } from 'react';
import type { Match } from '../types';
import { countByPlayer, emptyCounts, setScores, setsWon, sumCounts, toStats, type PlayerStats } from '../stats';
import { navigate } from '../router';

interface Col {
  group: string;
  label: string;
  get: (s: PlayerStats) => number | null;
  pct?: boolean;
}

const COLS: Col[] = [
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

const GROUPS = COLS.reduce<{ name: string; span: number }[]>((acc, c) => {
  if (acc.at(-1)?.name === c.group) acc.at(-1)!.span++;
  else acc.push({ name: c.group, span: 1 });
  return acc;
}, []);

const fmt = (v: number | null, col: Col) => (!v ? '–' : col.pct ? `${v} %` : col.label === '+/−' && v > 0 ? `+${v}` : String(v));

function download(filename: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function StatsView({ match }: { match: Match }) {
  const [set, setSet] = useState(0);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'fail'>('idle');
  // V Android aplikaci (a v online náhledu) nejde stahovat soubory ani tisknout.
  const canExport = !window.Capacitor?.isNativePlatform?.() && import.meta.env.MODE !== 'demo';

  const scores = setScores(match);
  const won = setsWon(match);
  const playedSets = scores.length;

  const { rows, total, oppErr, oppPoint } = useMemo(() => {
    const counts = countByPlayer(match.events, set || undefined);
    const players = [...match.players].sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));
    const inSet = match.events.filter((e) => !set || e.set === set);
    return {
      rows: players.map((p) => ({ player: p, stats: toStats(counts.get(p.id) ?? emptyCounts()) })),
      total: toStats(sumCounts(counts.values())),
      oppErr: inSet.filter((e) => e.type === 'oppErr').length,
      oppPoint: inSet.filter((e) => e.type === 'oppPoint').length,
    };
  }, [match, set]);

  function toTable(sep: string): string {
    const esc = (v: string) => (v.includes(sep) || v.includes('"') ? `"${v.replace(/"/g, '""')}"` : v);
    const head = ['Číslo', 'Hráč', ...COLS.map((c) => `${c.group} ${c.label}`)];
    const body = rows.map(({ player, stats }) => [player.number, player.name, ...COLS.map((c) => String(c.get(stats) ?? ''))]);
    const foot = ['', 'Celkem', ...COLS.map((c) => String(c.get(total) ?? ''))];
    return [head, ...body, foot].map((r) => r.map(esc).join(sep)).join('\r\n');
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(toTable('\t'));
      setCopyState('ok');
    } catch {
      setCopyState('fail');
    }
    setTimeout(() => setCopyState('idle'), 2500);
  }

  const fileName = `statistika-${match.date}-${match.team}-${match.opponent}`.replace(/[^\p{L}\d-]+/gu, '_');

  return (
    <main className="page page-wide">
      <header className="page-header no-print">
        <button className="btn btn-ghost" onClick={() => navigate(match.finished ? '' : `match/${match.id}`)}>
          ‹ {match.finished ? 'Zápasy' : 'Zpět k záznamu'}
        </button>
        <div className="actions">
          <button className="btn" onClick={copy}>
            {copyState === 'ok' ? 'Zkopírováno ✓' : copyState === 'fail' ? 'Kopírování se nepodařilo' : 'Kopírovat tabulku'}
          </button>
          {canExport && (
            <>
              <button className="btn" onClick={() => download(`${fileName}.csv`, '﻿' + toTable(';'), 'text/csv;charset=utf-8')}>
                Stáhnout CSV
              </button>
              <button className="btn" onClick={() => window.print()}>
                Tisk / PDF
              </button>
            </>
          )}
        </div>
      </header>

      <div className="stats-title">
        <h1>{match.team}</h1>
        <p>
          vs {match.opponent} · {new Date(match.date).toLocaleDateString('cs-CZ')} · sety <strong>{won.us}:{won.them}</strong>{' '}
          <span className="muted">({scores.map((s) => `${s.us}:${s.them}`).join(', ')})</span>
        </p>
      </div>

      <div className="chips no-print" role="group" aria-label="Zobrazit statistiku">
        {[0, ...Array.from({ length: playedSets }, (_, i) => i + 1)].map((n) => (
          <button key={n} className={`btn btn-sm ${set === n ? 'btn-primary' : ''}`} aria-pressed={set === n} onClick={() => setSet(n)}>
            {n ? `${n}. set` : 'Celý zápas'}
          </button>
        ))}
      </div>

      <div className="grid-wrap">
        <table className="stats-table">
          <caption className="sr-only">
            Statistika hráčů – {set ? `${set}. set` : 'celý zápas'}
          </caption>
          <thead>
            <tr>
              <th rowSpan={2} scope="col">
                #
              </th>
              <th rowSpan={2} scope="col" className="sticky-col">
                Hráč
              </th>
              {GROUPS.map((g) => (
                <th key={g.name} colSpan={g.span} scope="colgroup" className="group-head">
                  {g.name}
                </th>
              ))}
            </tr>
            <tr>
              {COLS.map((c) => (
                <th key={c.group + c.label} scope="col">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player, stats }) => (
              <tr key={player.id}>
                <td className="num">{player.number}</td>
                <th scope="row" className="sticky-col">
                  {player.name}
                  {player.libero && ' (L)'}
                </th>
                {COLS.map((c) => (
                  <td key={c.group + c.label}>{fmt(c.get(stats), c)}</td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td />
              <th scope="row" className="sticky-col">
                CELKEM
              </th>
              {COLS.map((c) => (
                <td key={c.group + c.label}>{fmt(c.get(total), c)}</td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="muted">
        Body z chyb soupeře: <strong>{oppErr}</strong> · Body soupeře bez naší chyby: <strong>{oppPoint}</strong>
      </p>
    </main>
  );
}
