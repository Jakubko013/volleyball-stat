export interface Player {
  id: string;
  number: string;
  name: string;
  libero?: boolean;
}

/** Akce hráče našeho týmu. */
export type PlayerAction =
  | 'srvAce'
  | 'srv'
  | 'srvErr'
  | 'rcv'
  | 'rcvErr'
  | 'atkKill'
  | 'atk'
  | 'atkErr'
  | 'atkBlocked'
  | 'blk'
  | 'err';

/** Týmové akce bez konkrétního hráče. */
export type TeamAction = 'oppErr' | 'oppPoint';

export type ActionType = PlayerAction | TeamAction;

export interface MatchEvent {
  id: string;
  set: number;
  type: ActionType;
  playerId?: string;
  t: number;
}

export interface Match {
  id: string;
  createdAt: number;
  date: string;
  team: string;
  opponent: string;
  competitionId?: string;
  /** Počet vítězných setů potřebných k výhře (3 = na tři vítězné). */
  setsToWin: number;
  players: Player[];
  /** Id hráčů aktuálně na hřišti, ostatní jsou na lavičce. */
  onCourt: string[];
  events: MatchEvent[];
  currentSet: number;
  finished: boolean;
}
