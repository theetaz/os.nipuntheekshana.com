/** Keep island requests outside the static content's first paint. */
export default function paint(load) {
  const hydrate = async () => { await (await load())(); };
  if (PerformanceObserver.supportedEntryTypes.includes('paint')) {
    const observer = new PerformanceObserver(list => {
      if (list.getEntries().some(entry => entry.name === 'first-contentful-paint')) {
        observer.disconnect(); void hydrate();
      }
    });
    observer.observe({ type: 'paint', buffered: true });
  } else requestAnimationFrame(() => requestAnimationFrame(hydrate));
}
