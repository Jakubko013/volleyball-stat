import { useMemo, useState } from 'react';
import type { ActionType, Match, MatchEvent, Player, Side } from '../types';
import type { MatchUpdater } from '../App';
import {
  PLAYER_ACTIONS,
  PLAYER_ACTION_KEYS,
  actionTitle,
  countByPlayer,
  emptyCounts,
  isSetOver,
  setScores,
  setsWon,
  teamName,
  teamPlayers,
  type ActionCounts,
} from '../stats';
import { uid } from '../storage';
import { navigate } from '../router';
import { ConfirmButton } from '../components/ConfirmButton';

const GROUPS = PLAYER_ACTION_KEYS.reduce<{ name: string; span: number }[]>((acc, key) => {
  const g = PLAYER_ACTIONS[key].group;
  if (acc.at(-1)?.name === g) acc.at(-1)!.span++;
  else acc.push({ name: g, span: 1 });
  return acc;
}, []);

const byNumber = (a: Player, b: Player) => (Number(a.number) || 99) - (Number(b.number) || 99);
const courtKey = (side: Side) => (side === 'us' ? 'onCourt' : 'oppOnCourt');

export function describeEvent(e: MatchEvent, match: Match): string {
  const p = [...match.players, ...match.oppPlayers].find((x) => x.id === e.playerId);
  const who = p ? `${e.team === 'them' ? `${match.opponent} ` : ''}#${p.number} ${p.name} – ` : '';
  return who + actionTitle(e.type);
}

/** Střídání: vybere se hráč na hřišti a hráč z lavičky téhož týmu (v libovolném pořadí). */
type Sub = { side: Side; out?: string; in?: string } | null;

export function Recording({ match, updateMatch }: { match: Match; updateMatch: MatchUpdater }) {
  const [last, setLast] = useState<MatchEvent | null>(null);
  const [sub, setSub] = useState<Sub>(null);
  const counts = useMemo(() => countByPlayer(match.events), [match.events]);
  const scores = setScores(match);
  const current = scores[match.currentSet - 1];
  const won = setsWon(match);
  const setOver = isSetOver(current, match.currentSet, match.setsToWin);
  const matchOver = won.us === match.setsToWin || won.them === match.setsToWin;
  const lastSet = match.currentSet >= match.setsToWin * 2 - 1;
  const sides: Side[] = match.oppPlayers.length ? ['us', 'them'] : ['us'];

  const lineup = useMemo(() => {
    const split = (side: Side) => {
      const all = [...teamPlayers(match, side)].sort(byNumber);
      const ids = match[courtKey(side)];
      const court = all.filter((p) => ids.includes(p.id));
      return { court, bench: all.filter((p) => !ids.includes(p.id)), regulars: court.filter((p) => !p.libero).length };
    };
    return { us: split('us'), them: split('them') };
  }, [match]);

  const label = (id?: string) => {
    const p = [...match.players, ...match.oppPlayers].find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : '';
  };

  const update = (fn: (m: Match) => Match) => updateMatch(match.id, fn);

  function setCourt(side: Side, fn: (ids: string[]) => string[]) {
    const key = courtKey(side);
    update((m) => ({ ...m, [key]: fn(m[key]) }));
    setSub(null);
  }

  function tapBench(side: Side, p: Player) {
    if (sub?.side === side && sub.out) return setCourt(side, (ids) => ids.map((x) => (x === sub.out ? p.id : x)));
    // Dokud není sestava kompletní (6 + libero), hráč z lavičky jde rovnou na hřiště.
    if (p.libero || lineup[side].regulars < 6) return setCourt(side, (ids) => [...ids, p.id]);
    setSub(sub?.in === p.id ? null : { side, in: p.id });
  }

  function tapCourt(side: Side, p: Player) {
    if (sub?.side === side && sub.in) return setCourt(side, (ids) => ids.map((x) => (x === p.id ? sub.in! : x)));
    setSub(sub?.out === p.id ? null : { side, out: p.id });
  }

  function record(type: ActionType, playerId?: string, side: Side = 'us') {
    const e: MatchEvent = { id: uid(), set: match.currentSet, type, playerId, team: side === 'them' ? 'them' : undefined, t: Date.now() };
    update((m) => ({ ...m, events: [...m.events, e] }));
    setLast(e);
    navigator.vibrate?.(15);
  }

  function undo() {
    update((m) => ({ ...m, events: m.events.slice(0, -1) }));
    setLast(null);
  }

  const removeEvent = (id: string) => update((m) => ({ ...m, events: m.events.filter((e) => e.id !== id) }));
  const nextSet = () => update((m) => ({ ...m, currentSet: m.currentSet + 1 }));
  function finish() {
    update((m) => ({ ...m, finished: true }));
    navigate(`match/${match.id}/stats`);
  }

  const history = match.events.filter((e) => e.set === match.currentSet).slice(-12).reverse();
  const needLineup = sides.filter((s) => lineup[s].regulars < 6 && lineup[s].bench.length > 0);

  return (
    <main className="page page-wide page-rec">
      <header className="rec-header">
        <button className="btn btn-ghost" onClick={() => navigate('')}>
          ‹ Zápasy
        </button>
        <div className="scoreboard" aria-label={`${match.currentSet}. set, skóre ${current.us} : ${current.them}`}>
          <span className="sb-team">{match.team}</span>
          <button className="sb-plus tone-good" onClick={() => record('oppErr')} aria-label={`Bod pro ${match.team} – chyba soupeře`}>
            +1<small>chyba soupeře</small>
          </button>
          <span className="sb-mid">
            <span className="sb-score">
              {current.us}:{current.them}
            </span>
            <span className="sb-sets">
              {match.currentSet}. set · sety {won.us}:{won.them}
              {scores.length > 1 && ` (${scores.slice(0, -1).map((s) => `${s.us}:${s.them}`).join(', ')})`}
            </span>
          </span>
          <button className="sb-plus tone-bad" onClick={() => record('oppPoint')} aria-label={`Bod pro ${match.opponent}`}>
            +1<small>bod soupeře</small>
          </button>
          <span className="sb-team">{match.opponent}</span>
        </div>
        <div className="actions">
          <button className="btn" onClick={undo} disabled={!match.events.length}>
            ↶ Zpět
          </button>
          <button className="btn" onClick={() => navigate(`match/${match.id}/stats`)}>
            Statistiky
          </button>
        </div>
      </header>

      {(setOver || matchOver) && (
        <div className="banner banner-ok" role="status">
          {matchOver ? (
            <>
              Zápas skončil {won.us}:{won.them}.{' '}
              <button className="btn btn-primary" onClick={finish}>
                Ukončit zápas
              </button>
            </>
          ) : (
            <>
              {match.currentSet}. set skončil {current.us}:{current.them}.{' '}
              {!lastSet && (
                <button className="btn btn-primary" onClick={nextSet}>
                  Zahájit {match.currentSet + 1}. set
                </button>
              )}
            </>
          )}
        </div>
      )}

      {sub ? (
        <div className="banner banner-sub" role="status">
          {sub.out
            ? `Střídání (${teamName(match, sub.side)}): klepněte na hráče z lavičky, který jde na hřiště místo ${label(sub.out)}.`
            : `Střídání (${teamName(match, sub.side)}): klepněte na jméno hráče na hřišti, kterého ${label(sub.in)} vystřídá.`}
          {sub.out && (
            <button className="btn" onClick={() => setCourt(sub.side, (ids) => ids.filter((x) => x !== sub.out))}>
              Jen poslat na lavičku
            </button>
          )}
          <button className="btn" onClick={() => setSub(null)}>
            Zrušit
          </button>
        </div>
      ) : (
        needLineup.length > 0 && (
          <div className="banner banner-sub" role="status">
            Základní sestava: klepněte na hráče na lavičce, kteří jdou na hřiště (
            {needLineup.map((s) => `${teamName(match, s)} ${lineup[s].regulars}/6`).join(', ')} + libero).
          </div>
        )
      )}

      <div className="grid-wrap">
        <table className="rec-grid">
          <thead>
            <tr>
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
              {PLAYER_ACTION_KEYS.map((k) => (
                <th key={k} scope="col" className={`tone-${PLAYER_ACTIONS[k].tone}`}>
                  {PLAYER_ACTIONS[k].label}
                </th>
              ))}
            </tr>
          </thead>
          {sides.map((side) => (
            <tbody key={side} className={`team-${side}`}>
              {sides.length > 1 && (
                <tr className="team-row">
                  <th scope="colgroup" className="sticky-col">
                    {teamName(match, side)}
                  </th>
                  <td colSpan={PLAYER_ACTION_KEYS.length} />
                </tr>
              )}
              {lineup[side].court.map((p) => (
                <PlayerRow
                  key={p.id}
                  player={p}
                  counts={counts.get(p.id) ?? emptyCounts()}
                  selected={sub?.out === p.id}
                  onSwap={() => tapCourt(side, p)}
                  onRecord={(k) => record(k, p.id, side)}
                />
              ))}
            </tbody>
          ))}
        </table>
      </div>

      <div className="benches">
        {sides.map(
          (side) =>
            lineup[side].bench.length > 0 && (
              <section key={side} className="bench" aria-labelledby={`bench-${side}`}>
                <h2 id={`bench-${side}`}>Lavička – {teamName(match, side)}</h2>
                <div className="chips">
                  {lineup[side].bench.map((p) => (
                    <button
                      key={p.id}
                      className={`btn btn-sm bench-chip ${sub?.in === p.id ? 'btn-primary' : ''}`}
                      onClick={() => tapBench(side, p)}
                      aria-pressed={sub?.in === p.id}
                      aria-label={`#${p.number} ${p.name}${p.libero ? ' (libero)' : ''} – na hřiště`}
                    >
                      <strong>{p.number || '–'}</strong> {p.name}
                      {p.libero && <span className="badge">L</span>}
                    </button>
                  ))}
                </div>
              </section>
            ),
        )}
      </div>

      <div className="actions">
        {!lastSet && !setOver && (
          <ConfirmButton onConfirm={nextSet} confirmText={`Ukončit ${match.currentSet}. set? Klepněte znovu`}>
            Další set
          </ConfirmButton>
        )}
        <ConfirmButton onConfirm={finish} confirmText="Ukončit zápas? Klepněte znovu">
          Ukončit zápas
        </ConfirmButton>
      </div>

      {history.length > 0 && (
        <section className="card" aria-labelledby="hist">
          <h2 id="hist">Poslední akce v {match.currentSet}. setu</h2>
          <ul className="history">
            {history.map((e) => (
              <li key={e.id} className={e.team === 'them' ? 'hist-them' : ''}>
                <span>{describeEvent(e, match)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeEvent(e.id)} aria-label={`Smazat akci ${describeEvent(e, match)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="last-action" aria-live="polite">
        {last ? `Zapsáno: ${describeEvent(last, match)}` : ''}
      </div>
    </main>
  );
}

interface PlayerRowProps {
  player: Player;
  counts: ActionCounts;
  selected: boolean;
  onSwap: () => void;
  onRecord: (k: (typeof PLAYER_ACTION_KEYS)[number]) => void;
}

function PlayerRow({ player: p, counts: c, selected, onSwap, onRecord }: PlayerRowProps) {
  return (
    <tr>
      <th scope="row" className="sticky-col" title={p.name}>
        <button className="player-cell" onClick={onSwap} aria-pressed={selected} aria-label={`Vystřídat #${p.number} ${p.name}`}>
          <span className="pnum">{p.number || '–'}</span>
          <span className="pname">{p.name}</span>
          {p.libero && <span className="badge">L</span>}
          <span className="swap" aria-hidden="true">
            ⇄
          </span>
        </button>
      </th>
      {PLAYER_ACTION_KEYS.map((k) => {
        const def = PLAYER_ACTIONS[k];
        if (p.libero && !def.liberoAllowed) return <td key={k} className="cell-off" aria-hidden="true" />;
        return (
          <td key={k}>
            <button className={`cell tone-${def.tone}`} onClick={() => onRecord(k)} aria-label={`${p.number} ${p.name}: ${def.title} (zatím ${c[k]})`}>
              <span className="cnt">{c[k]}</span>
              <span className="lbl">{def.label}</span>
            </button>
          </td>
        );
      })}
    </tr>
  );
}
