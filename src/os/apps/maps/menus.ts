import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  file: [{ kind: 'item', label: 'Play Pin the city', command: 'maps.play' }],
  view: [
    { kind: 'item', label: 'Explore', command: 'maps.explore', role: 'radio' },
    { kind: 'item', label: 'Play', command: 'maps.play', role: 'radio' },
    { kind: 'separator' },
    { kind: 'item', label: 'Town labels', command: 'maps.labels', role: 'checkbox' },
    { kind: 'item', label: 'Graticule', command: 'maps.graticule', role: 'checkbox' },
    { kind: 'item', label: 'Coastline', command: 'maps.coastline', role: 'checkbox' },
    { kind: 'separator' },
    { kind: 'item', label: 'Zoom in', command: 'maps.zoom-in' },
    { kind: 'item', label: 'Zoom out', command: 'maps.zoom-out' },
    { kind: 'item', label: 'Recentre', command: 'maps.recentre' },
  ],
};
