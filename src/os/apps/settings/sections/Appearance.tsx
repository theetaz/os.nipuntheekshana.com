import { Segmented } from '../../../ui/Segmented';
import type { SectionProps } from '../settings';

const themes = [{ value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }, { value: 'auto', label: 'Automatic' }] as const;
const accents = [{ value: 'thambili', label: 'Thambili' }, { value: 'lagoon', label: 'Lagoon' }, { value: 'lotus', label: 'Lotus' }, { value: 'tea', label: 'Tea' }] as const;
export function Appearance({ preferences, actions }: SectionProps) {
  return <>
    <h2>Appearance</h2><p className="settings-description">Make yourself at home.</p>
    <div className="settings-group"><h3>Theme</h3>
      <Segmented label="Theme" className="settings-theme" value={preferences.theme}
        options={themes.map(theme => ({ value: theme.value, disabled: !actions, label: <>
          <span className={`settings-theme-preview settings-theme-${theme.value}`} aria-hidden="true">
            <span className="settings-mini-window"><span className="settings-mini-bar"><i /><i /><i /></span>
              <span className="settings-mini-sidebar" /><span className="settings-mini-line" /><span className="settings-mini-line short" /></span>
          </span><span>{theme.label}</span></> }))}
        onChange={value => { const theme = themes.find(item => item.value === value); if (theme) actions?.theme(theme.value); }} />
      <p className="settings-hint">Automatic follows your device’s appearance.</p>
    </div>
    <div className="settings-group"><h3>Accent colour</h3>
      <Segmented label="Accent colour" className="settings-accents" value={preferences.accent}
        options={accents.map(accent => ({ value: accent.value, disabled: !actions, label: <>
          <span aria-hidden="true" title={accent.label} className={`settings-swatch settings-swatch-${accent.value}`} />
          <span className="settings-accent-name">{accent.label}</span></> }))}
        onChange={value => { const accent = accents.find(item => item.value === value); if (accent) actions?.accent(accent.value); }} />
    </div>
  </>;
}
