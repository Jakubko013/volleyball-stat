import { describe, expect, it } from 'vitest';
import type { ActionType, MatchEvent } from './types';
import { countByPlayer, isSetOver, setScores, setsWon, sumCounts, toStats } from './stats';

let n = 0;
const ev = (type: ActionType, set = 1, playerId?: string): MatchEvent => ({ id: String(n++), set, type, playerId, t: 0 });
const repeat = (count: number, type: ActionType, set = 1, playerId?: string) => Array.from({ length: count }, () => ev(type, set, playerId));

describe('skóre', () => {
  it('připíše body správné straně', () => {
    const events = [ev('srvAce', 1, 'a'), ev('atkKill', 1, 'a'), ev('oppErr'), ev('srvErr', 1, 'a'), ev('atk', 1, 'a'), ev('oppPoint')];
    expect(setScores({ events, currentSet: 1 })).toEqual([{ us: 3, them: 2 }]);
  });

  it('pozná konec setu včetně tie-breaku a rozdílu 2 bodů', () => {
    expect(isSetOver({ us: 25, them: 23 }, 1, 3)).toBe(true);
    expect(isSetOver({ us: 25, them: 24 }, 1, 3)).toBe(false);
    expect(isSetOver({ us: 15, them: 13 }, 5, 3)).toBe(true);
    expect(isSetOver({ us: 15, them: 13 }, 3, 2)).toBe(true);
    expect(isSetOver({ us: 15, them: 13 }, 3, 3)).toBe(false);
  });

  it('spočítá vyhrané sety', () => {
    const events = [...repeat(25, 'oppErr', 1), ...repeat(20, 'oppPoint', 1), ...repeat(25, 'oppPoint', 2), ...repeat(10, 'oppErr', 3)];
    expect(setsWon({ events, currentSet: 3, setsToWin: 3 })).toEqual({ us: 1, them: 1 });
  });
});

describe('statistika hráče', () => {
  it('sečte podání, přihrávku, útok, blok a úspěšnost', () => {
    const events = [
      ev('srvAce', 1, 'a'), ev('srv', 1, 'a'), ev('srvErr', 2, 'a'),
      ev('rcv', 1, 'a'), ev('rcvErr', 1, 'a'),
      ev('atkKill', 1, 'a'), ev('atkKill', 1, 'a'), ev('atk', 1, 'a'), ev('atkBlocked', 1, 'a'),
      ev('blk', 1, 'a'), ev('err', 1, 'a'), ev('atkKill', 1, 'b'), ev('oppErr', 1),
    ];
    const s = toStats(countByPlayer(events).get('a')!);
    expect(s).toMatchObject({ srvTot: 3, srvErr: 1, srvAce: 1, rcvTot: 2, rcvErr: 1, atkTot: 4, atkKill: 2, atkBlocked: 1, atkPct: 50, blk: 1 });
    expect(s.points).toBe(4);
    expect(s.errors).toBe(4);
    expect(s.plusMinus).toBe(0);
    expect(toStats(countByPlayer(events, 2).get('a')!).srvErr).toBe(1);
    expect(toStats(sumCounts(countByPlayer(events).values())).atkKill).toBe(3);
  });

  it('bez útoku nemá úspěšnost', () => {
    expect(toStats(countByPlayer([ev('rcv', 1, 'a')]).get('a')!).atkPct).toBeNull();
  });
});
