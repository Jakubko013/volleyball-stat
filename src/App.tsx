import { useCallback, useEffect, useState } from 'react';
import type { Match } from './types';
import { loadMatches, saveMatches } from './storage';
import { Home } from './screens/Home';
import { Setup } from './screens/Setup';
import { Recording } from './screens/Recording';
import { StatsView } from './screens/StatsView';
import { getRoute, navigate } from './router';
import { createDemoMatch } from './demo';

export type MatchUpdater = (id: string, update: (m: Match) => Match) => void;

export function App() {
  const [route, setRoute] = useState(getRoute);
  const [matches, setMatches] = useState<Match[]>(() => {
    const stored = loadMatches();
    return import.meta.env.MODE === 'demo' && !stored.length ? [createDemoMatch()] : stored;
  });
  const [saveFailed, setSaveFailed] = useState(false);

  useEffect(() => {
    const onHash = () => setRoute(getRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    setSaveFailed(!saveMatches(matches));
  }, [matches]);

  const updateMatch: MatchUpdater = useCallback((id, update) => {
    setMatches((list) => list.map((m) => (m.id === id ? update(m) : m)));
  }, []);

  const [screen, id, sub] = route;
  const match = id ? matches.find((m) => m.id === id) : undefined;

  let content;
  if (screen === 'new') {
    content = (
      <Setup
        onCreate={(m) => {
          setMatches((list) => [m, ...list]);
          navigate(`match/${m.id}`);
        }}
      />
    );
  } else if (screen === 'match' && match) {
    content =
      sub === 'stats' ? <StatsView match={match} /> : <Recording match={match} updateMatch={updateMatch} />;
  } else {
    content = <Home matches={matches} onDelete={(mid) => setMatches((list) => list.filter((m) => m.id !== mid))} />;
  }

  return (
    <>
      {saveFailed && (
        <div className="banner banner-bad" role="alert">
          Data se nepodařilo uložit do zařízení (plné úložiště?). Neukončujte aplikaci.
        </div>
      )}
      {content}
    </>
  );
}
