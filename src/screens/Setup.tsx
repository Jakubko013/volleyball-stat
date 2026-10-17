import { useState, type Dispatch, type SetStateAction } from 'react';
import type { Match, Player } from '../types';
import { fetchRoster, fetchTeams, parseCompetitionId, parseRosterText, type CvfTeam, type RosterEntry } from '../cvf';
import { loadRosters, saveRoster, uid } from '../storage';
import { navigate } from '../router';

const DEFAULT_COMPETITION = 'https://www.cvf.cz/souteze/celostatni-souteze?mode=clubs&competitionId=18658';
const LAST_COMPETITION_KEY = 'vs:lastCompetition';

type Row = Player & { active: boolean };
type Status = { tone: 'ok' | 'bad'; text: string } | null;

const toRows = (list: RosterEntry[]): Row[] =>
  list.map((p) => ({ ...p, id: uid(), active: true })).sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));

function readLastCompetition() {
  try {
    return localStorage.getItem(LAST_COMPETITION_KEY) || DEFAULT_COMPETITION;
  } catch {
    return DEFAULT_COMPETITION;
  }
}

/** Hráči, kteří hrají, připravení do zápasu (bez prázdných řádků). */
const playing = (rows: Row[]) =>
  rows.filter((r) => r.active && r.name.trim()).map(({ active: _active, ...p }) => ({ ...p, name: p.name.trim(), number: p.number.trim() }));

const allNamed = (rows: Row[]) =>
  rows.filter((r) => r.name.trim()).map(({ active: _active, ...p }) => ({ ...p, name: p.name.trim(), number: p.number.trim() }));

export function Setup({ onCreate }: { onCreate: (m: Match) => void }) {
  const [competition, setCompetition] = useState(readLastCompetition);
  const [teams, setTeams] = useState<CvfTeam[]>([]);
  const [team, setTeam] = useState('');
  const [opponent, setOpponent] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [oppRows, setOppRows] = useState<Row[]>([]);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [setsToWin, setSetsToWin] = useState(3);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const savedRosters = loadRosters();

  const competitionId = parseCompetitionId(competition);

  async function loadTeams() {
    if (!competitionId) return setStatus({ tone: 'bad', text: 'Zadejte odkaz na soutěž z cvf.cz nebo její číslo.' });
    setBusy(true);
    setStatus(null);
    try {
      const list = await fetchTeams(competitionId);
      setTeams(list);
      try {
        localStorage.setItem(LAST_COMPETITION_KEY, competition);
      } catch {
        /* nevadí */
      }
      setStatus(
        list.length
          ? { tone: 'ok', text: `Načteno ${list.length} družstev. Vyberte svůj tým a soupeře.` }
          : { tone: 'bad', text: 'Na stránce nebyla nalezena žádná družstva. Zkontrolujte odkaz.' },
      );
    } catch {
      setStatus({ tone: 'bad', text: 'Nepodařilo se spojit s cvf.cz. Zkontrolujte internet, nebo zadejte tým a hráče ručně.' });
    } finally {
      setBusy(false);
    }
  }

  /** Načte soupisku týmu z cvf.cz; když to nejde, použije uloženou soupisku. */
  async function loadRoster(name: string, setter: Dispatch<SetStateAction<Row[]>>) {
    const saved = savedRosters.find((r) => r.team === name);
    const applySaved = (reason: string) => {
      if (saved) {
        setter(saved.players.map((p) => ({ ...p, active: true })));
        setStatus({ tone: 'ok', text: `${reason}Použita uložená soupiska týmu ${name} z ${new Date(saved.savedAt).toLocaleDateString('cs-CZ')}.` });
      } else if (reason) {
        setStatus({ tone: 'bad', text: `${reason}Vložte hráče týmu ${name} ručně.` });
      }
    };
    const cvfTeam = teams.find((t) => t.name === name);
    if (!cvfTeam || !competitionId) return applySaved('');
    setBusy(true);
    setStatus(null);
    try {
      const roster = await fetchRoster(competitionId, cvfTeam.id);
      if (!roster.length) return applySaved('Soupisku se na cvf.cz nepodařilo najít. ');
      // cvf.cz často nemá čísla dresů – doplní se z dříve uložené soupisky (podle jména).
      const known = new Map((saved?.players ?? []).map((p) => [p.name.toLowerCase(), p]));
      setter(
        toRows(
          roster.map((p) => {
            const s = known.get(p.name.toLowerCase());
            return s ? { ...p, number: p.number || s.number, libero: p.libero ?? s.libero } : p;
          }),
        ),
      );
      setStatus({ tone: 'ok', text: `Načteno ${roster.length} hráčů týmu ${name}. Doplňte čísla dresů a odškrtněte, kdo nehraje.` });
    } catch {
      applySaved('Soupisku se nepodařilo stáhnout. ');
    } finally {
      setBusy(false);
    }
  }

  const players = playing(rows);
  const canStart = team.trim() && opponent.trim() && players.length > 0;

  function start() {
    if (!canStart) return;
    saveRoster(team.trim(), allNamed(rows));
    if (allNamed(oppRows).length) saveRoster(opponent.trim(), allNamed(oppRows));
    onCreate({
      id: uid(),
      createdAt: Date.now(),
      date,
      team: team.trim(),
      opponent: opponent.trim(),
      competitionId: competitionId ?? undefined,
      setsToWin,
      players,
      onCourt: [],
      oppPlayers: playing(oppRows),
      oppOnCourt: [],
      events: [],
      currentSet: 1,
      finished: false,
    });
  }

  return (
    <main className="page">
      <header className="page-header">
        <button className="btn btn-ghost" onClick={() => navigate('')}>
          ‹ Zápasy
        </button>
        <h1>Nový zápas</h1>
      </header>

      <section className="card form" aria-labelledby="sec-comp">
        <h2 id="sec-comp">1. Soutěž na cvf.cz</h2>
        <label className="field">
          <span>Odkaz na soutěž nebo číslo soutěže</span>
          <input value={competition} onChange={(e) => setCompetition(e.target.value)} inputMode="url" />
        </label>
        <button className="btn btn-primary" onClick={loadTeams} disabled={busy}>
          {busy ? 'Načítám…' : 'Načíst družstva'}
        </button>
      </section>

      {status && (
        <p className={`banner ${status.tone === 'ok' ? 'banner-ok' : 'banner-bad'}`} role="status">
          {status.text}
        </p>
      )}

      <section className="card form" aria-labelledby="sec-match">
        <h2 id="sec-match">2. Zápas</h2>
        <datalist id="teams">
          {teams.map((t) => (
            <option key={t.id} value={t.name} />
          ))}
          {savedRosters
            .filter((r) => !teams.some((t) => t.name === r.team))
            .map((r) => (
              <option key={r.team} value={r.team} />
            ))}
        </datalist>
        <div className="grid-2">
          <label className="field">
            <span>Náš tým</span>
            <input
              list="teams"
              value={team}
              onChange={(e) => {
                setTeam(e.target.value);
                loadRoster(e.target.value, setRows);
              }}
              placeholder="Vyberte nebo napište"
            />
          </label>
          <label className="field">
            <span>Soupeř</span>
            <input
              list="teams"
              value={opponent}
              onChange={(e) => {
                setOpponent(e.target.value);
                loadRoster(e.target.value, setOppRows);
              }}
              placeholder="Vyberte nebo napište"
            />
          </label>
          <label className="field">
            <span>Datum</span>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="field">
            <span>Hraje se na</span>
            <select value={setsToWin} onChange={(e) => setSetsToWin(Number(e.target.value))}>
              <option value={3}>3 vítězné sety</option>
              <option value={2}>2 vítězné sety</option>
            </select>
          </label>
        </div>
      </section>

      <RosterEditor id="players" title="3. Naši hráči" rows={rows} setRows={setRows} onStatus={setStatus} />
      <RosterEditor
        id="opp"
        title="4. Hráči soupeře"
        hint="Nepovinné. Vyplňte, pokud chcete statistiku i pro soupeře."
        rows={oppRows}
        setRows={setOppRows}
        onStatus={setStatus}
      />

      <div className="actions sticky-bottom">
        <button className="btn btn-primary btn-lg" onClick={start} disabled={!canStart}>
          Zahájit zápas
        </button>
        {!canStart && <span className="muted">Vyplňte náš tým, soupeře a aspoň jednoho našeho hráče.</span>}
      </div>
    </main>
  );
}

interface RosterEditorProps {
  id: string;
  title: string;
  hint?: string;
  rows: Row[];
  setRows: Dispatch<SetStateAction<Row[]>>;
  onStatus: (s: Status) => void;
}

function RosterEditor({ id, title, hint, rows, setRows, onStatus }: RosterEditorProps) {
  const [pasteText, setPasteText] = useState('');
  const patchRow = (rowId: string, patch: Partial<Row>) => setRows((r) => r.map((p) => (p.id === rowId ? { ...p, ...patch } : p)));
  const activeCount = rows.filter((r) => r.active && r.name.trim()).length;

  function addFromText() {
    const parsed = parseRosterText(pasteText);
    if (!parsed.length) return onStatus({ tone: 'bad', text: 'V textu nebyl nalezen žádný hráč.' });
    setRows((r) => [...r, ...toRows(parsed)]);
    setPasteText('');
    onStatus({ tone: 'ok', text: `Přidáno ${parsed.length} hráčů.` });
  }

  return (
    <section className="card form" aria-labelledby={`sec-${id}`}>
      <h2 id={`sec-${id}`}>
        {title} <span className="muted">({activeCount} hraje)</span>
      </h2>
      {hint && <p className="muted">{hint}</p>}
      {rows.length > 0 && (
        <table className="roster">
          <thead>
            <tr>
              <th scope="col">Hraje</th>
              <th scope="col">Číslo</th>
              <th scope="col">Jméno</th>
              <th scope="col">Libero</th>
              <th scope="col">
                <span className="sr-only">Odebrat</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className={p.active ? '' : 'inactive'}>
                <td>
                  <input type="checkbox" checked={p.active} onChange={(e) => patchRow(p.id, { active: e.target.checked })} aria-label={`${p.name} hraje`} />
                </td>
                <td>
                  <input
                    className="num-input"
                    value={p.number}
                    inputMode="numeric"
                    maxLength={2}
                    onChange={(e) => patchRow(p.id, { number: e.target.value.replace(/\D/g, '') })}
                    aria-label={`Číslo dresu – ${p.name}`}
                  />
                </td>
                <td>
                  <input value={p.name} onChange={(e) => patchRow(p.id, { name: e.target.value })} aria-label="Jméno hráče" />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={!!p.libero}
                    onChange={(e) => patchRow(p.id, { libero: e.target.checked || undefined })}
                    aria-label={`${p.name} je libero`}
                  />
                </td>
                <td>
                  <button className="btn btn-ghost btn-sm" onClick={() => setRows((r) => r.filter((x) => x.id !== p.id))} aria-label={`Odebrat ${p.name}`}>
                    ✕
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="actions">
        <button className="btn" onClick={() => setRows((r) => [...r, { id: uid(), number: '', name: '', active: true }])}>
          + Přidat hráče
        </button>
      </div>
      <details>
        <summary>Vložit soupisku jako text</summary>
        <label className="field">
          <span>Jeden hráč na řádek, např. „7 Novák Jan“ nebo „1 Dvořák Petr (L)“. Lze vložit i řádky zkopírované z tabulky na webu.</span>
          <textarea rows={6} value={pasteText} onChange={(e) => setPasteText(e.target.value)} />
        </label>
        <button className="btn" onClick={addFromText} disabled={!pasteText.trim()}>
          Přidat hráče z textu
        </button>
      </details>
    </section>
  );
}
