import { Segmented } from '../../../ui/Segmented';
import { Button } from '../../../ui/Button';
import type { SectionProps } from '../settings';

export function Accessibility({ preferences, actions }: SectionProps) {
  return <>
    <h2>Accessibility</h2><p className="settings-description">A desktop at your own pace.</p>
    <div className="settings-group"><h3>Motion</h3>
      <Segmented label="Motion" value={preferences.motion} options={['system', 'reduce', 'full'].map(value => ({ value,
        label: value === 'system' ? 'System' : value === 'reduce' ? 'Reduce' : 'Full', disabled: !actions }))}
        onChange={value => { if (value === 'system' || value === 'reduce' || value === 'full') actions?.motion(value); }} />
      <p className="settings-hint">Reduce keeps animations quiet and turns off dock magnification.</p>
    </div>
    <div className="settings-group"><h3>Transparency</h3>
      <Segmented label="Transparency" value={preferences.transparency} options={[
        { value: 'system', label: 'System', disabled: !actions }, { value: 'reduce', label: 'Reduce', disabled: !actions },
      ]} onChange={value => { if (value === 'system' || value === 'reduce') actions?.transparency(value); }} />
      <p className="settings-hint">Reduce uses solid backgrounds for glass surfaces.</p>
    </div>
    <div className="settings-group settings-links">
      {actions ? <Button onClick={actions.simple}>Switch to simple view</Button> : <a href="#simple">Switch to simple view</a>}
      <a href="/readme?section=shortcuts" onClick={event => { if (actions && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey) { event.preventDefault(); actions.shortcuts(); } }}>Keyboard shortcuts</a>
    </div>
  </>;
}
