import { Menu } from '../ui/Menu';
import { desktopMenus, islandMenu } from '../registry/menus';
import { openApp, runCommand } from '../wm/commands';
export function PhoneMenu({ anchor, onClose }: { anchor: HTMLElement | null; onClose: () => void }) {
  if (!anchor) return null;
  const items = [...islandMenu(), ...desktopMenus().filter(menu => ['go','view','help'].includes(menu.id)).map(menu => ({kind:'submenu' as const,label:menu.label,items:menu.items}))];
  return <Menu label="Serendib menu" anchorRef={{current:anchor}} items={items} onClose={onClose} onCommand={command => {
    if (command === 'os.shortcuts') openApp('readme', {query:{section:'shortcuts'}});
    else runCommand(command,'menu');
  }}/>;
}
