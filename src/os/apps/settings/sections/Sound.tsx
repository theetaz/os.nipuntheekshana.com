import { Switch } from '../../../ui/Switch';
import { Slider } from '../../../ui/Slider';
import { Button } from '../../../ui/Button';
import type { SectionProps } from '../settings';

export function Sound({ preferences, actions }: SectionProps) {
  const volume = Math.round(preferences.volume * 100);
  return <>
    <h2>Sound</h2><p className="settings-description">Small sounds. Off until you ask.</p>
    <div className="settings-group"><Switch label="Interface sounds" checked={preferences.sound} disabled={!actions}
      onChange={value => actions?.sound(value)}>Interface sounds</Switch></div>
    <div className="settings-group settings-volume"><Slider label="Volume" min={0} max={100} step={1} value={volume}
      aria-valuetext={`${volume}%`} disabled={!actions} onChange={value => actions?.volume(value / 100)} />
      <span className="settings-volume-value" aria-hidden="true">{volume}%</span></div>
    <Button disabled={!actions || !preferences.sound || !preferences.volume} onClick={actions?.sample}>Play a sample</Button>
  </>;
}
