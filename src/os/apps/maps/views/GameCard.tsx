import { useEffect, useRef, useState } from 'react';
import { hintForDistance, rankForScore, ROUNDS, type PinState } from '../../../scenes/pin-game';
export function GameCard({ state, best, onNext, onAgain, onClose }: { state: PinState; best: number; onNext(): void; onAgain(): void; onClose(): void }) {
  const next = useRef<HTMLButtonElement>(null); const [shared, setShared] = useState('');
  useEffect(() => { if (state.phase === 'reveal' || state.phase === 'done') next.current?.focus({ preventScroll: true }); }, [state.phase]);
  async function share() {
    try { await navigator.clipboard.writeText(`I scored ${state.score.toLocaleString('en-US')} / 5,000 in Pin the city: https://os.nipuntheekshana.com/maps/play`); setShared('Score copied.'); }
    catch { setShared('Couldn’t copy. Try copying the score below.'); }
  }
  return <section className="maps-game maps-glass" aria-label="Pin the city">
    <header><span className="maps-eyebrow">Pin the city</span><button type="button" aria-label="Leave game" onClick={onClose}>×</button></header>
    <div className="maps-game-round"><span>{state.phase === 'done' ? 'Final' : `Round ${state.round || 1} / ${ROUNDS}`}</span>{state.phase !== 'done' && <span>Score {state.score.toLocaleString('en-US')}</span>}</div>
    <div aria-live="polite" aria-atomic="true">
      <h2>{state.phase === 'done' ? `${state.score.toLocaleString('en-US')} / 5,000` : state.place?.name ?? 'Ready to explore?'}</h2>
      {state.phase !== 'done' && <p className="maps-city-si" lang="si">{state.place?.si ?? 'ශ්‍රී ලංකාව'}</p>}
      <p>{state.phase === 'done' ? rankForScore(state.score) : state.phase === 'reveal' ? hintForDistance(state.km, state.points) : 'Tap the map where you think it is.'}</p>
      {state.phase === 'reveal' && <p>{state.place?.name} · {state.km < 1 ? '<1' : Math.round(state.km)} km</p>}
      {state.phase === 'done' && <p>Best: {Math.max(best, state.score).toLocaleString('en-US')}</p>}
    </div>
    {state.phase === 'guess' && <p className="maps-game-keys">Arrows move the crosshair. Shift moves further. Return places your pin.</p>}
    {(state.phase === 'reveal' || state.phase === 'done') && <button ref={next} type="button" className="maps-primary" data-accent-filled="true" onClick={state.phase === 'done' ? onAgain : onNext}>{state.phase === 'done' ? 'Play again' : state.round === ROUNDS ? 'See my score' : 'Next city'}</button>}
    {state.phase === 'done' && <><button className="maps-secondary" type="button" onClick={() => { void share(); }}>Share score</button><p role="status">{shared}</p></>}
  </section>;
}
