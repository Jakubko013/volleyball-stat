import { useState } from 'react';
import type { Match, Player } from '../types';
import { fetchRoster, fetchTeams, parseCompetitionId, parseRosterText, type CvfTeam, type RosterEntry } from '../cvf';
import { loadRosters, saveRoster, uid } from '../storage';
import { navigate } from '../router';

const DEFAULT_COMPETITION = 'https://www.cvf.cz/souteze/celostatni-souteze?mode=clubs&competitionId=18658';
const LAST_COMPETITION_KEY = 'vs:lastCompetition';

type Row = Player & { active: boolean };

const toRows = (list: RosterEntry[]): Row[] =>
  list.map((p) => ({ ...p, id: uid(), active: true })).sort((a, b) => (Number(a.number) || 99) - (Number(b.number) || 99));

function readLastCompetition() {
  try {
    return localStorage.getItem(LAST_COMPETITION_KEY) || DEFAULT_COMPETITION;
  } catch {
    return DEFAULT_COMPETITION;
  }
}

export function Setup({ onCreate }: { onCreate: (m: Match) => void }) {
  const [competition, setCompetition] = useState(readLastCompetition);
  const [teams, setTeams] = useState<CvfTeam[]>([]);
  const [team, setTeam] = useState('');
  const [opponent, setOpponent] = useState('');
  const [rows, setRows] = useState<Row[]>([]);
  const [date, setDate] = useState(() => new Date().toLocaleDateString('sv-SE'));
  const [setsToWin, setSetsToWin] = useState(3);
  const [pasteText, setPasteText] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{ tone: 'ok' | 'bad'; text: string } | null>(null);
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
          ? { tone: 'ok', text: `Načteno ${list.length} družstev. Vyberte svůj tým.` }
          : { tone: 'bad', text: 'Na stránce nebyla nalezena žádná družstva. Zkontrolujte odkaz.' },
      );
    } catch {
      setStatus({ tone: 'bad', text: 'Nepodařilo se spojit s cvf.cz. Zkontrolujte internet, nebo zadejte tým a hráče ručně.' });
    } finally {
      setBusy(false);
    }
  }

  async function chooseTeam(name: string) {
    setTeam(name);
    const cvfTeam = teams.find((t) => t.name === name);
    if (!cvfTeam || !competitionId) return;
    setBusy(true);
    setStatus(null);
    try {
      const roster = await fetchRoster(competitionId, cvfTeam.id);
      if (roster.length) {
        setRows(toRows(roster));
        setStatus({ tone: 'ok', text: `Načteno ${roster.length} hráčů z cvf.cz. Doplňte čísla dresů a odškrtněte, kdo nehraje.` });
      } else {
        fallbackToSaved(name, 'Soupisku se na cvf.cz nepodařilo najít.');
      }
    } catch {
      fallbackToSaved(name, 'Soupisku se nepodařilo stáhnout.');
    } finally {
      setBusy(false);
    }
  }

  function fallbackToSaved(name: string, reason: string) {
    const saved = savedRosters.find((r) => r.team === name);
    if (saved) {
      setRows(saved.players.map((p) => ({ ...p, active: true })));
      setStatus({ tone: 'ok', text: `${reason} Použita uložená soupiska z ${new Date(saved.savedAt).toLocaleDateString('cs-CZ')}.` });
    } else {
      setStatus({ tone: 'bad', text: `${reason} Vložte hráče ručně níže.` });
    }
  }

  function addFromText() {
    const parsed = parseRosterText(pasteText);
    if (!parsed.length) return setStatus({ tone: 'bad', text: 'V textu nebyl nalezen žádný hráč.' });
    setRows((r) => [...r, ...toRows(parsed)]);
    setPasteText('');
    setStatus({ tone: 'ok', text: `Přidáno ${parsed.length} hráčů.` });
  }

  const patchRow = (id: string, patch: Partial<Row>) => setRows((r) => r.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const active = rows.filter((r) => r.active && r.name.trim());
  const canStart = team.trim() && opponent.trim() && active.length > 0;

  function start() {
    if (!canStart) return;
    const players = rows
      .filter((r) => r.name.trim())
      .map(({ active: _active, ...p }) => ({ ...p, name: p.name.trim(), number: p.number.trim() }));
    saveRoster(team.trim(), players);
    onCreate({
      id: uid(),
      createdAt: Date.now(),
      date,
      team: team.trim(),
      opponent: opponent.trim(),
      competitionId: competitionId ?? undefined,
      setsToWin,
      players: players.filter((p) => active.some((a) => a.id === p.id)),
      onCourt: [],
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
          {savedRosters.map((r) => (
            <option key={r.team} value={r.team} />
          ))}
        </datalist>
        <div className="grid-2">
          <label className="field">
            <span>Náš tým</span>
            <input list="teams" value={team} onChange={(e) => chooseTeam(e.target.value)} placeholder="Vyberte nebo napište" />
          </label>
          <label className="field">
            <span>Soupeř</span>
            <input list="teams" value={opponent} onChange={(e) => setOpponent(e.target.value)} placeholder="Vyberte nebo napište" />
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
        {savedRosters.length > 0 && !rows.length && (
          <div className="chips">
            <span className="muted">Uložené soupisky:</span>
            {savedRosters.map((r) => (
              <button
                key={r.team}
                className="btn btn-sm"
                onClick={() => {
                  setTeam(r.team);
                  setRows(r.players.map((p) => ({ ...p, active: true })));
                }}
              >
                {r.team}
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="card form" aria-labelledby="sec-players">
        <h2 id="sec-players">
          3. Hráči <span className="muted">({active.length} hraje)</span>
        </h2>
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
                    <input className="num-input" value={p.number} inputMode="numeric" maxLength={2} onChange={(e) => patchRow(p.id, { number: e.target.value.replace(/\D/g, '') })} aria-label={`Číslo dresu – ${p.name}`} />
                  </td>
                  <td>
                    <input value={p.name} onChange={(e) => patchRow(p.id, { name: e.target.value })} aria-label="Jméno hráče" />
                  </td>
                  <td>
                    <input type="checkbox" checked={!!p.libero} onChange={(e) => patchRow(p.id, { libero: e.target.checked || undefined })} aria-label={`${p.name} je libero`} />
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

      <div className="actions sticky-bottom">
        <button className="btn btn-primary btn-lg" onClick={start} disabled={!canStart}>
          Zahájit zápas
        </button>
        {!canStart && <span className="muted">Vyplňte náš tým, soupeře a aspoň jednoho hráče.</span>}
      </div>
    </main>
  );
}
