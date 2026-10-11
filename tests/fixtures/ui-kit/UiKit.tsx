import { useEffect, useRef, useState } from 'react';
import { Search, Folder } from 'lucide-react';
import { Button } from '../../../src/os/ui/Button';
import { IconButton } from '../../../src/os/ui/IconButton';
import { Segmented } from '../../../src/os/ui/Segmented';
import { SearchField } from '../../../src/os/ui/SearchField';
import { Switch } from '../../../src/os/ui/Switch';
import { Slider } from '../../../src/os/ui/Slider';
import { Chip } from '../../../src/os/ui/Chip';
import { Pill } from '../../../src/os/ui/Pill';
import { Kbd } from '../../../src/os/ui/Kbd';
import { Tooltip } from '../../../src/os/ui/Tooltip';
import { Menu } from '../../../src/os/ui/Menu';
import { Popover } from '../../../src/os/ui/Popover';
import { Sidebar, SidebarSection, SidebarRow } from '../../../src/os/ui/Sidebar';
import { Toolbar } from '../../../src/os/ui/Toolbar';
import { StatusBar } from '../../../src/os/ui/StatusBar';
import { Skeleton, SkeletonText, SkeletonTile } from '../../../src/os/ui/Skeleton';
import { EmptyState } from '../../../src/os/ui/EmptyState';
import { ErrorState } from '../../../src/os/ui/ErrorState';
import { Prose } from '../../../src/os/ui/Prose';
import { Img, type ImageSet } from '../../../src/os/ui/Img';
import { AppIcon } from '../../../src/os/ui/AppIcon';
import { DeviceFrame } from '../../../src/os/ui/DeviceFrame';
import { focusableWithin, trapTab } from '../../../src/os/lib/focus';
import { useAppData } from '../../../src/os/lib/fetch-json';
import type { MenuItemSpec } from '../../../src/os/types/apps';
const items: readonly MenuItemSpec[] = [
  { kind: 'item', label: 'Open', command: 'open', shortcut: { code: 'KeyO', mod: true } },
  { kind: 'item', label: 'Unavailable', command: 'disabled' },
  { kind: 'separator' }, { kind: 'item', label: 'Show status bar', command: 'status', role: 'checkbox' },
  { kind: 'item', label: 'Icons', command: 'icons', role: 'radio' },
  { kind: 'item', label: 'List', command: 'list', role: 'radio' },
  { kind: 'submenu', label: 'Sort by', items: [
    { kind: 'item', label: 'Name', command: 'name' },
    { kind: 'submenu', label: 'More', items: [{ kind: 'item', label: 'Year', command: 'year' }] },
  ] }, { kind: 'windows' },
];
const image: ImageSet = { src: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2264%22 height=%2264%22%3E%3C/svg%3E', width: 64, height: 64, avif: '', webp: '', alt: 'Island image' };
function DataProbe() {
  const { data, error, retry } = useAppData<{ title: string }>('fixture', '/__ui-data.json');
  return <div><span data-testid="app-data">{error?.message ?? data?.title ?? 'Waiting for data'}</span><Button onClick={retry}>Retry data</Button></div>;
}
export default function UiKit({ interactive = false }: { interactive?: boolean }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [menu, setMenu] = useState(!interactive); const menuTrigger = useRef<HTMLButtonElement>(null);
  const [popover, setPopover] = useState(!interactive); const popoverTrigger = useRef<HTMLButtonElement>(null);
  const [modal, setModal] = useState(false); const modalTrigger = useRef<HTMLButtonElement>(null);
  const [value, setValue] = useState('icons'); const [checked, setChecked] = useState(false);
  const [status, setStatus] = useState(true); const [command, setCommand] = useState('None'); const [slider, setSlider] = useState(50);
  const [links, setLinks] = useState(0); const [focusCount, setFocusCount] = useState(0);
  return <main data-ui-hydrated={hydrated} className="mx-auto max-w-4xl space-y-6 p-6">
    <h1 className="text-title-1">UI kit verification</h1>
    <svg width="0" height="0" aria-hidden="true"><defs><symbol id="app-projects" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="var(--os-accent)" /><path d="M20 20h24v24H20z" fill="var(--os-on-accent)" /></symbol></defs></svg>
    <Toolbar label="Actions"><Button variant="primary" size={36}>Primary</Button><Button size={32}>Secondary</Button><Button variant="ghost" size={28}>Ghost</Button><Button variant="danger">Danger</Button><Button disabled>Disabled</Button><IconButton aria-label="Search icon"><Search size={16} /></IconButton></Toolbar>
    <section aria-label="Controls" className="flex flex-wrap items-center gap-4">
      <Segmented label="View" options={[{ value: 'icons', label: 'Icons' }, { value: 'disabled', label: 'Disabled view', disabled: true }, { value: 'list', label: 'List' }]} value={value} onChange={setValue} />
      <SearchField label="Search projects" placeholder="Search projects" />
      <Switch label="Sound" checked={checked} onChange={setChecked}>Sound</Switch>
      <Slider label="Volume" min={0} max={100} step={5} value={slider} onChange={setSlider} />
      <Chip selected={checked} onClick={() => setChecked(!checked)}>Active chip</Chip>
      <Pill tone="success">Active</Pill><Pill tone="warning">Incubating</Pill><Pill tone="danger">Failed</Pill><Pill tone="info">Info</Pill><Pill>Neutral</Pill><Kbd>⌘K</Kbd>
    </section>
    <section aria-label="Overlay controls" className="flex flex-wrap gap-4">
      <Tooltip content="A helpful description"><Button>Tooltip trigger</Button></Tooltip>
      <Button ref={menuTrigger} aria-haspopup="menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>Menu trigger</Button>
      <Menu label="Actions menu" items={items} open={menu} anchorRef={menuTrigger} autoFocus={interactive}
        windowItems={[{ kind: 'item', label: 'Window one', command: 'window' }]} onClose={() => setMenu(false)}
        getItemState={id => ({ disabled: id === 'disabled', checked: id === 'status' ? status : id === value })}
        onCommand={id => { setCommand(id); if (id === 'status') setStatus(!status); if (id === 'icons' || id === 'list') setValue(id); }} />
      <Button ref={popoverTrigger} aria-haspopup="dialog" aria-expanded={popover} onClick={() => setPopover(!popover)}>Popover trigger</Button>
      <Popover label="Information" open={popover} onClose={() => setPopover(false)} anchorRef={popoverTrigger}><Button onClick={() => setPopover(false)}>Close information</Button></Popover>
      <Button ref={modalTrigger} aria-haspopup="dialog" aria-expanded={modal} onClick={() => setModal(true)}>Modal trigger</Button>
      <Popover label="Modal information" modal open={modal} onClose={() => setModal(false)} anchorRef={modalTrigger}><Button>First modal</Button><Button>Last modal</Button></Popover>
    </section>
    <output data-testid="command">{command}</output>
    <div className="flex gap-6"><Sidebar label="Project filters"><SidebarSection title="Favourites"><SidebarRow selected icon={<Folder />} count={18}>All projects</SidebarRow><SidebarRow>Featured</SidebarRow></SidebarSection></Sidebar>
      <div><Skeleton><SkeletonTile /><SkeletonText /><SkeletonText /></Skeleton><EmptyState title="Nothing here yet." body="Try another folder." /><ErrorState onRetry={() => setCommand('retry')} simpleHref="/#simple" /></div>
    </div>
    <StatusBar hint="Space to preview">18 projects</StatusBar>
    <Prose html='<h2>Trusted content</h2><p><a href="/">Internal link</a> <a href="https://example.com">External link</a> <a href="/" download>Download</a></p>' onLinkClick={() => { setLinks(links + 1); return true; }} />
    <output data-testid="links">{links}</output>
    <div className="flex gap-6"><AppIcon icon="app-projects" label="Projects icon" /><Img image={image} />
      <DeviceFrame kind="phone"><Img image={image} /></DeviceFrame><DeviceFrame kind="browser" bar="example.com"><Img image={image} /></DeviceFrame><DeviceFrame kind="bare"><Img image={image} /></DeviceFrame></div>
    <div data-testid="focus-box" tabIndex={-1} onKeyDown={event => trapTab(event, event.currentTarget)} className="flex gap-4">
      <Button>Focus first</Button><Button disabled>Focus disabled</Button><div hidden><Button>Focus hidden</Button></div>
      <div inert><Button>Focus inert</Button></div><input aria-label="Focus input" disabled /><Button>Focus last</Button>
    </div>
    <Button onClick={event => setFocusCount(focusableWithin(event.currentTarget.previousElementSibling as HTMLElement).length)}>Count focusable</Button><output data-testid="focus-count">{focusCount}</output>
    {interactive && <DataProbe />}
  </main>;
}
