export const springs = {
  windowOpen: { type: 'spring', stiffness: 420, damping: 34, mass: 0.9 },
  windowSnap: { type: 'spring', stiffness: 380, damping: 36, mass: 1 },
  windowRestore: { type: 'spring', stiffness: 320, damping: 32, mass: 1 },
  dockMagnify: { type: 'spring', stiffness: 380, damping: 28, mass: 0.6 },
  sheet: { type: 'spring', stiffness: 380, damping: 36, mass: 1 },
  popover: { type: 'spring', stiffness: 600, damping: 40, mass: 0.8 },
  mochiHome: { type: 'spring', stiffness: 170, damping: 11, mass: 1 },
} as const;
export const easings = {
  out: [0.22, 1, 0.36, 1], in: [0.4, 0, 1, 1],
  inOut: [0.65, 0, 0.35, 1], suck: [0.32, 0.72, 0, 1],
} as const;
// Motion durations are seconds; CSS tokens use milliseconds.
export const durations = {
  close: 0.14, minimise: 0.36, menuIn: 0.12, menuOut: 0.08,
  tooltipIn: 0.1, snapPreview: 0.14, toastIn: 0.22, toastOut: 0.16,
  themeFade: 0.24, hover: 0.12,
} as const;
