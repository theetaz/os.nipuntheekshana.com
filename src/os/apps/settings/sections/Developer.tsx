import { lazy, Suspense } from 'react';

const Tools = lazy(() => import('../../../eggs/devmode').then(module => ({ default: module.DeveloperTools })));

export default function Developer() {
  return <Suspense fallback={<><h2>Developer</h2><p className="settings-description">Loading developer tools…</p></>}><Tools /></Suspense>;
}
