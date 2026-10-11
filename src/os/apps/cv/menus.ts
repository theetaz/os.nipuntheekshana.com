import type { AppMenus } from '../../types/apps';
export const menus: AppMenus = {
  file: [
    { kind: 'item', label: 'Print', command: 'cv.print', shortcut: { code: 'KeyP', mod: true } },
    { kind: 'item', label: 'Download PDF', command: 'cv.download' },
  ],
  view: [
    { kind: 'item', label: 'Zoom in', command: 'cv.zoomIn', shortcut: { code: 'Equal', alt: true } },
    { kind: 'item', label: 'Zoom out', command: 'cv.zoomOut', shortcut: { code: 'Minus', alt: true } },
    { kind: 'item', label: 'Actual size', command: 'cv.actualSize', shortcut: { code: 'Digit0', alt: true } },
    { kind: 'item', label: 'Fit width', command: 'cv.fitWidth' },
    { kind: 'separator' },
    { kind: 'item', label: 'Show thumbnails', command: 'cv.thumbnails', role: 'checkbox' },
  ],
};
