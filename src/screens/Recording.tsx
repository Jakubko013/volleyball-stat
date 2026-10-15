import { useMemo, useState } from 'react';
import type { ActionType, Match, MatchEvent, Player } from '../types';
import type { MatchUpdater } from '../App';
import { PLAYER_ACTIONS, PLAYER_ACTION_KEYS, actionTitle, countByPlayer, emptyCounts, isSetOver, setScores, setsWon } from '../stats';
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

export function describeEvent(e: MatchEvent, players: Player[]): string {
  const p = players.find((x) => x.id === e.playerId);
  return `${p ? `#${p.number} ${p.name} – ` : ''}${actionTitle(e.type)}`;
}

export function Recording({ match, updateMatch }: { match: Match; updateMatch: MatchUpdater }) {
  const [last, setLast] = useState<MatchEvent | null>(null);
  const players = useMemo(() => [...match.players].sort(byNumber), [match.players]);
  const counts = useMemo(() => countByPlayer(match.events), [match.events]);
  const scores = setScores(match);
  const current = scores[match.currentSet - 1];
  const won = setsWon(match);
  const setOver = isSetOver(current, match.currentSet, match.setsToWin);
  const matchOver = won.us === match.setsToWin || won.them === match.setsToWin;
  const lastSet = match.currentSet >= match.setsToWin * 2 - 1;

  // Střídání: vybere se hráč na hřišti a hráč z lavičky (v libovolném pořadí).
  const [subOut, setSubOut] = useState<string | null>(null);
  const [subIn, setSubIn] = useState<string | null>(null);
  const court = players.filter((p) => match.onCourt.includes(p.id));
  const bench = players.filter((p) => !match.onCourt.includes(p.id));
  const courtRegulars = court.filter((p) => !p.libero).length;
  const label = (id: string | null) => {
    const p = players.find((x) => x.id === id);
    return p ? `#${p.number} ${p.name}` : '';
  };

  const update = (fn: (m: Match) => Match) => updateMatch(match.id, fn);

  function setCourt(fn: (ids: string[]) => string[]) {
    update((m) => ({ ...m, onCourt: fn(m.onCourt) }));
    setSubOut(null);
    setSubIn(null);
  }

  function tapBench(id: string, libero?: boolean) {
    if (subOut) return setCourt((ids) => ids.map((x) => (x === subOut ? id : x)));
    // Dokud není sestava kompletní (6 + libero), hráč z lavičky jde rovnou na hřiště.
    if (libero || courtRegulars < 6) return setCourt((ids) => [...ids, id]);
    setSubIn(subIn === id ? null : id);
  }

  function tapCourt(id: string) {
    if (subIn) return setCourt((ids) => ids.map((x) => (x === id ? subIn : x)));
    setSubOut(subOut === id ? null : id);
  }

  function record(type: ActionType, playerId?: string) {
    const e: MatchEvent = { id: uid(), set: match.currentSet, type, playerId, t: Date.now() };
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

  return (
    <main className="page page-wide">
      <header className="rec-header">
        <button className="btn btn-ghost" onClick={() => navigate('')}>
          ‹ Zápasy
        </button>
        <div className="scoreboard" aria-label={`${match.currentSet}. set, skóre ${current.us} : ${current.them}`}>
          <span className="sb-team">{match.team}</span>
          <span className="sb-score">
            {current.us}:{current.them}
          </span>
          <span className="sb-team">{match.opponent}</span>
          <span className="sb-sets">
            {match.currentSet}. set · sety {won.us}:{won.them}
            {scores.length > 1 && ` (${scores.slice(0, -1).map((s) => `${s.us}:${s.them}`).join(', ')})`}
          </span>
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

      <div className="team-actions">
        <button className="btn btn-good btn-lg" onClick={() => record('oppErr')}>
          Chyba soupeře <small>(bod pro nás)</small>
        </button>
        <button className="btn btn-bad btn-lg" onClick={() => record('oppPoint')}>
          Bod soupeře
        </button>
      </div>

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

      {subOut || subIn ? (
        <div className="banner banner-sub" role="status">
          {subOut
            ? `Střídání: klepněte na hráče z lavičky, který jde na hřiště místo ${label(subOut)}.`
            : `Střídání: klepněte na jméno hráče na hřišti, kterého ${label(subIn)} vystřídá.`}
          {subOut && (
            <button className="btn" onClick={() => setCourt((ids) => ids.filter((x) => x !== subOut))}>
              Jen poslat na lavičku
            </button>
          )}
          <button
            className="btn"
            onClick={() => {
              setSubOut(null);
              setSubIn(null);
            }}
          >
            Zrušit
          </button>
        </div>
      ) : (
        courtRegulars < 6 &&
        bench.length > 0 && (
          <div className="banner banner-sub" role="status">
            Základní sestava: klepněte na hráče na lavičce, kteří jdou na hřiště ({courtRegulars}/6 + libero).
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
          <tbody>
            {court.map((p) => {
              const c = counts.get(p.id) ?? emptyCounts();
              return (
                <tr key={p.id}>
                  <th scope="row" className="sticky-col" title={p.name}>
                    <button
                      className="player-cell"
                      onClick={() => tapCourt(p.id)}
                      aria-pressed={subOut === p.id}
                      aria-label={`Vystřídat #${p.number} ${p.name}`}
                    >
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
                        <button
                          className={`cell tone-${def.tone}`}
                          onClick={() => record(k, p.id)}
                          aria-label={`${p.number} ${p.name}: ${def.title} (zatím ${c[k]})`}
                        >
                          <span className="cnt">{c[k]}</span>
                          <span className="lbl">{def.label}</span>
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {bench.length > 0 && (
        <section className="bench" aria-labelledby="bench-title">
          <h2 id="bench-title">Lavička</h2>
          <div className="chips">
            {bench.map((p) => (
              <button
                key={p.id}
                className={`btn bench-chip ${subIn === p.id ? 'btn-primary' : ''}`}
                onClick={() => tapBench(p.id, p.libero)}
                aria-pressed={subIn === p.id}
                aria-label={`#${p.number} ${p.name}${p.libero ? ' (libero)' : ''} – na hřiště`}
              >
                <strong>{p.number || '–'}</strong> {p.name}
                {p.libero && <span className="badge">L</span>}
              </button>
            ))}
          </div>
        </section>
      )}

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
              <li key={e.id}>
                <span>{describeEvent(e, match.players)}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => removeEvent(e.id)} aria-label={`Smazat akci ${describeEvent(e, match.players)}`}>
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="last-action" aria-live="polite">
        {last ? `Zapsáno: ${describeEvent(last, match.players)}` : ''}
      </div>
    </main>
  );
}
