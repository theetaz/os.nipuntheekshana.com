/** A cancellable one-shot line: no timer remains once the command is complete. */
export function typeLine(el: Element, text: string, reduce: boolean, done: () => void = () => {}): () => void {
  let timer: ReturnType<typeof setTimeout>;
  let index = 0;
  const render = (line: string) => {
    el.textContent = line;
    // Move the caret with a transform so each character causes no layout shift.
    el.parentElement?.style.setProperty('--k-chars', String(line.length));
  };
  const tick = () => {
    render(text.slice(0, ++index));
    if (index < text.length) timer = setTimeout(tick, 26);
    else done();
  };
  render(reduce ? text : '');
  if (reduce) done();
  else timer = setTimeout(tick, 110);
  return () => clearTimeout(timer);
}
