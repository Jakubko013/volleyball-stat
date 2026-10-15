import type { ActionType, Match, MatchEvent, Player } from './types';
import { isSetOver, setScores } from './stats';

/** Ukázkový rozehraný zápas pro online náhled (build s --mode demo). Jména jsou smyšlená. */
export function createDemoMatch(): Match {
  const players: Player[] = [
    { id: 'p1', number: '1', name: 'Kučera Jakub', libero: true },
    { id: 'p3', number: '3', name: 'Horák Martin' },
    { id: 'p4', number: '4', name: 'Beneš Lukáš' },
    { id: 'p7', number: '7', name: 'Pokorný Tomáš' },
    { id: 'p9', number: '9', name: 'Marek David' },
    { id: 'p11', number: '11', name: 'Fiala Ondřej' },
    { id: 'p12', number: '12', name: 'Zeman Vojtěch' },
    { id: 'p15', number: '15', name: 'Růžička Petr' },
    { id: 'p17', number: '17', name: 'Kolář Adam' },
  ];
  const court = ['p3', 'p4', 'p7', 'p9', 'p11', 'p12'];
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
  const pick = <T,>(list: T[]) => list[Math.floor(rnd() * list.length)];
  const weighted = (w: [ActionType, number][]) => {
    let r = rnd() * w.reduce((s, [, n]) => s + n, 0);
    return w.find(([, n]) => (r -= n) < 0)![0];
  };

  const match: Match = {
    id: 'demo',
    createdAt: Date.now(),
    date: new Date().toLocaleDateString('sv-SE'),
    team: 'TJ Ukázka',
    opponent: 'VK Soupeř',
    setsToWin: 3,
    players,
    onCourt: ['p1', ...court],
    events: [],
    currentSet: 1,
    finished: false,
  };
  const add = (type: ActionType, playerId?: string) =>
    match.events.push({ id: String(match.events.length), set: match.currentSet, type, playerId, t: 0 } as MatchEvent);

  const rally = () => {
    if (rnd() < 0.5) add('rcv', rnd() < 0.5 ? 'p1' : pick(court));
    if (rnd() < 0.4) add(rnd() < 0.85 ? 'srv' : 'srvErr', pick(court));
    if (rnd() < 0.3) add('atk', pick(court));
    if (rnd() < 0.55) {
      const t = weighted([['atkKill', 60], ['blk', 14], ['srvAce', 10], ['oppErr', 16]]);
      add(t, t === 'oppErr' ? undefined : pick(court));
    } else {
      const t = weighted([['oppPoint', 45], ['atkErr', 15], ['atkBlocked', 10], ['rcvErr', 15], ['err', 5]]);
      add(t, t === 'oppPoint' ? undefined : t === 'rcvErr' && rnd() < 0.5 ? 'p1' : pick(court));
    }
  };

  while (!isSetOver(setScores(match)[0], 1, 3)) rally();
  match.currentSet = 2;
  while (setScores(match)[1].us + setScores(match)[1].them < 26) rally();
  return match;
}
