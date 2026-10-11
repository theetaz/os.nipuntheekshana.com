import { Switch } from '../../../ui/Switch';
import { Button } from '../../../ui/Button';
import type { SectionProps } from '../settings';

export function MochiSection({ preferences, actions }: SectionProps) {
  return <>
    <h2>Mochi</h2><p className="settings-description">Your tiny desktop companion.</p>
    <div className="settings-group"><Switch label="Show Mochi" checked={preferences.mochi.visible} disabled={!actions}
      onChange={visible => actions?.mochi({ visible })}>Show Mochi</Switch></div>
    <div className="settings-group"><Switch label="Mochi naps when idle" checked={preferences.mochi.naps} disabled={!actions}
      onChange={naps => actions?.mochi({ naps })}>Mochi naps when idle</Switch></div>
    <div className="settings-group settings-row"><p className="settings-pets">Pets so far: {preferences.mochi.pets}</p>
      <Button disabled={!actions || !preferences.mochi.pets} onClick={actions?.resetPets}>Reset</Button></div>
  </>;
}
