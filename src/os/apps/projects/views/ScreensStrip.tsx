import type { ClientProject } from '../../../types/content';
import { Img } from '../../../ui/Img';
import { DeviceFrame } from '../../../ui/DeviceFrame';

export function ScreensStrip({ project, onPreview }: { project: ClientProject; onPreview?: (index: number, element: HTMLElement) => void }) {
  if (!project.screens.length) return null;
  return <section className="project-screens" aria-label="Screens"><h2>Screens</h2><div className="project-screens-strip">
    {project.screens.map((screen, index) => {
      const label = `Open screen ${index + 1} of ${project.screens.length}: ${screen.label}`;
      const content = <DeviceFrame kind={screen.kind} bar={screen.bar ?? project.brand?.address ?? project.brand?.domain} className="project-screen-frame" data-kind={screen.kind}>
        <Img image={screen} sizes={screen.kind === 'phone' ? `${Math.round(260 * screen.width / screen.height)}px` : '320px'}
          style={screen.trimBottom && screen.kind === 'phone' ? { height: `${252 / (1 - screen.trimBottom)}px`, marginBottom: `${-252 * screen.trimBottom / (1 - screen.trimBottom)}px` } : undefined} />
      </DeviceFrame>;
      return <figure key={screen.src}>
        {onPreview ? <button type="button" aria-label={label} onClick={event => onPreview(index, event.currentTarget)}>{content}</button>
          : <a href={screen.src} target="_blank" rel="noopener noreferrer" aria-label={label}>{content}</a>}
        <figcaption>{screen.label}</figcaption>
      </figure>;
    })}
  </div></section>;
}
