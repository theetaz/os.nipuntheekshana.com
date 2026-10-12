import { Button } from '../../../ui/Button';
import { runCommand } from '../../../wm/commands';
import type { SectionProps } from '../settings';

export function Desktop({ actions }: SectionProps) {
  return <><h2>Desktop</h2><p className="settings-description">Keep your corner of Kottu tidy.</p>
    <div className="settings-group settings-reset"><Button disabled={!actions} onClick={() => runCommand('desktop.cleanUp', 'menu')}>Reset prop positions</Button>
      <p className="settings-hint">Return desktop props to their original places.</p></div>
    <div className="settings-group settings-reset"><Button disabled={!actions} onClick={actions?.resetGeometry}>Reset window sizes and positions</Button>
      <p className="settings-hint">New windows will use their default sizes and positions.</p></div></>;
}
