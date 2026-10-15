import type { Match } from '../types';
import { setsWon } from '../stats';
import { navigate } from '../router';
import { ConfirmButton } from '../components/ConfirmButton';

interface Props {
  matches: Match[];
  onDelete: (id: string) => void;
}

export function Home({ matches, onDelete }: Props) {
  return (
    <main className="page">
      <header className="page-header">
        <h1>Volejbal Statistika</h1>
        <button className="btn btn-primary btn-lg" onClick={() => navigate('new')}>
          + Nový zápas
        </button>
      </header>

      {matches.length === 0 ? (
        <p className="empty">Zatím žádné zápasy. Začněte tlačítkem „Nový zápas“.</p>
      ) : (
        <ul className="match-list">
          {matches.map((m) => {
            const won = setsWon(m);
            return (
              <li key={m.id} className="card match-item">
                <div>
                  <div className="match-title">
                    {m.team} <span className="muted">vs</span> {m.opponent}
                  </div>
                  <div className="muted">
                    {new Date(m.date).toLocaleDateString('cs-CZ')} · sety {won.us}:{won.them} ·{' '}
                    {m.finished ? 'ukončen' : 'probíhá'}
                  </div>
                </div>
                <div className="actions">
                  {!m.finished && (
                    <button className="btn btn-primary" onClick={() => navigate(`match/${m.id}`)}>
                      Pokračovat
                    </button>
                  )}
                  <button className="btn" onClick={() => navigate(`match/${m.id}/stats`)}>
                    Statistiky
                  </button>
                  <ConfirmButton
                    className="btn btn-ghost"
                    aria-label={`Smazat zápas ${m.team} vs ${m.opponent}`}
                    confirmText="Opravdu smazat?"
                    onConfirm={() => onDelete(m.id)}
                  >
                    Smazat
                  </ConfirmButton>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </main>
  );
}
