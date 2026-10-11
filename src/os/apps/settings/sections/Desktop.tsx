import { Switch } from '../../../ui/Switch';
import { Button } from '../../../ui/Button';
import type { SectionProps } from '../settings';

export function Desktop({ preferences, actions }: SectionProps) {
  return <>
    <h2>Desktop</h2><p className="settings-description">Keep your corner of Serendib tidy.</p>
    <div className="settings-group"><Switch label="Show widgets" checked={preferences.widgets} disabled={!actions}
      onChange={value => actions?.widgets(value)}>Show widgets</Switch></div>
    <div className="settings-group settings-reset"><Button disabled={!actions} onClick={actions?.resetIcons}>Reset icon positions</Button>
      <p className="settings-hint">Return desktop icons to their original places.</p></div>
    <div className="settings-group settings-reset"><Button disabled={!actions} onClick={actions?.resetGeometry}>Reset window sizes and positions</Button>
      <p className="settings-hint">New windows will use their default sizes and positions.</p></div>
  </>;
}
