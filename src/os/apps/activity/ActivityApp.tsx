import { useLayoutEffect } from 'react';
import type { AppProps } from '../../registry/apps';
export { menus } from './menus';
export default function ActivityApp({ ready, scrollRootRef }: AppProps) {
  useLayoutEffect(() => ready(), [ready]);
  return <div ref={scrollRootRef as React.RefObject<HTMLDivElement>} data-scroll-root className="static-content"><div className="static-document"><h1>Activity</h1></div></div>;
}
