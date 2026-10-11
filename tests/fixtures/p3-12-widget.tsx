import { useLayoutEffect, useState } from 'react';
import { Provider } from 'jotai';
import { LazyMotion } from 'motion/react';
import { createOsStore, registerStore } from '../../src/os/state/store';
import { loadMotionFeatures } from '../../src/os/lib/motion-loader';
import { Mochi } from '../../src/os/mochi/Mochi';

export default function MochiWidgetFixture() {
  const [store] = useState(() => createOsStore());
  useLayoutEffect(() => registerStore(store), [store]);
  return <Provider store={store}><LazyMotion features={loadMotionFeatures} strict>
    <main style={{ width: 171, height: 171, margin: 24 }}><Mochi variant="widget" /></main>
  </LazyMotion></Provider>;
}
