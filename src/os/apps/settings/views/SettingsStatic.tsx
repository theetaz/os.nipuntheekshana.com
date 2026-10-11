import { SettingsView } from './SettingsView';
import { DEFAULT_PREFERENCES, type SettingsData } from '../settings';

export function SettingsStatic({ data }: { data: SettingsData }) {
  return <SettingsView preferences={DEFAULT_PREFERENCES} data={data} liveUnavailable="Requires JavaScript and WebGL." />;
}
