import { cloneElement, type JSX, type SVGProps } from 'react';
import { ISLAND_PATH } from './island-glyph';

/** Public sprite identifiers, also used by the app metadata. */
export type AppIconId =
  | 'app-projects' | 'app-about' | 'app-writing' | 'app-messages' | 'app-terminal' | 'app-maps'
  | 'app-activity' | 'app-cv' | 'app-settings' | 'app-now' | 'app-readme' | 'app-trash' | 'app-trash-full'
  | 'app-pin' | 'app-guestbook' | 'folder-projects' | 'folder-writing' | 'doc-cv'
  | 'link-github' | 'link-linkedin' | 'link-prabhava';

const displayFont = 'var(--font-fraunces, Fraunces), Georgia, serif';
const writingFont = 'var(--font-display, Shrikhand), Georgia, serif';
const monoFont = 'var(--font-martian, "Martian Mono"), ui-monospace, Menlo, monospace';
const sinhalaFont = '"Noto Sans Sinhala", "Sinhala Sangam MN", "Sinhala MN", "Nirmala UI", "Iskoola Pota", sans-serif';

function Tile({ fill }: { fill: string }) {
  return <rect x="1.5" y="1.5" width="61" height="61" rx="14.4" fill={fill} stroke="#1B1530" strokeWidth="3" />;
}

function Stack({ folder = false }: { folder?: boolean }) {
  return <g fill="#FFF7E8" stroke="#1B1530" strokeWidth="3" opacity={folder ? '.25' : undefined}>
    <rect x="21" y="12" width="27" height="33" rx="5" opacity=".55" transform="rotate(10 34 28)" />
    <rect x="17" y="15" width="27" height="33" rx="5" opacity=".75" transform="rotate(-7 30 31)" />
    <rect x="19" y="18" width="27" height="33" rx="5" />
    {!folder && <path d="M25.5 28h.01m6.99 0h.01m6.99 0h.01M25.5 35h.01m6.99 0h.01m6.99 0h.01M25.5 42h.01m6.99 0h.01m6.99 0h.01" stroke="#FF8A3D" strokeWidth="4" strokeLinecap="round" />}
  </g>;
}

function AboutSymbol({ avatarUrl }: { avatarUrl?: string }) {
  return <symbol id="app-about" viewBox="0 0 64 64">
    <Tile fill="#0FA3A3" />
    <circle cx="32" cy="32" r="20" fill="#0FA3A3" />
    <text style={avatarUrl ? { display: 'none' } : undefined} x="32" y="38" textAnchor="middle" fontFamily={displayFont} fontWeight="600" fontSize="18" fill="#fff">NT</text>
    {avatarUrl && <>
      <defs><clipPath id="c-about-avatar"><circle cx="32" cy="32" r="20" /></clipPath></defs>
      <image href={avatarUrl} x="12" y="12" width="40" height="40" preserveAspectRatio="xMidYMid slice" clipPath="url(#c-about-avatar)" />
    </>}
    <circle cx="32" cy="32" r="20" fill="none" stroke="#1B1530" strokeWidth="3" />
  </symbol>;
}

function Page({ desktop = false, readme = false }: { desktop?: boolean; readme?: boolean }) {
  return <g transform={desktop ? undefined : 'translate(6 5) scale(.82)'}>
    <path d="M15 6h24l11 11v39a3 3 0 0 1-3 3H15a3 3 0 0 1-3-3V9a3 3 0 0 1 3-3Z" fill="#FFFDF8" stroke="#1B1530" strokeWidth="3" />
    <path d="M39 6v9a2 2 0 0 0 2 2h9" fill="#FFF7E8" stroke="#1B1530" strokeWidth="3" />
    {readme ? <>
      <text x="17" y="26" fontFamily={monoFont} fontWeight="600" fontSize="7" textLength="27" lengthAdjust="spacingAndGlyphs" fill="#1B1530">READ ME</text>
      <path d="M17 33h26M17 38h26M17 43h22M17 48h26M17 53h14" stroke="#1B1530" strokeWidth="1.6" strokeLinecap="round" />
    </> : <>
      {/* Fraunces 600, 15px CV outlines (Fraunces-OFL.txt); no document-font request for an icon. */}
      <path data-glyph="CV" d="M27.06 28.23Q27.06 28.76 26.77 29.3Q26.48 29.84 25.94 30.29Q25.39 30.74 24.61 31.01Q23.83 31.28 22.85 31.28Q21.23 31.28 20.05 30.58Q18.87 29.88 18.23 28.65Q17.59 27.41 17.59 25.81Q17.59 24.6 17.97 23.59Q18.35 22.57 19.04 21.82Q19.72 21.07 20.65 20.65Q21.57 20.24 22.65 20.24Q23.41 20.24 23.88 20.38Q24.35 20.53 24.62 20.68Q24.89 20.84 25.04 20.84Q25.23 20.84 25.33 20.7Q25.43 20.57 25.54 20.44Q25.64 20.31 25.83 20.31Q25.96 20.31 26.05 20.4Q26.13 20.49 26.2 20.68L26.99 23.27Q27.05 23.45 26.96 23.59Q26.87 23.72 26.69 23.76Q26.52 23.79 26.38 23.72Q26.23 23.65 26.15 23.46Q25.75 22.57 25.25 22.04Q24.76 21.51 24.19 21.28Q23.62 21.05 22.96 21.05Q22.29 21.05 21.74 21.35Q21.18 21.65 20.78 22.22Q20.38 22.78 20.15 23.57Q19.93 24.35 19.93 25.33Q19.93 26.84 20.4 27.89Q20.86 28.93 21.68 29.48Q22.5 30.02 23.54 30.02Q24.53 30.02 25.27 29.54Q26.01 29.07 26.42 28.2Q26.51 28.02 26.61 27.97Q26.71 27.91 26.84 27.93Q26.96 27.95 27.01 28.02Q27.06 28.1 27.06 28.23ZM34.89 20.84Q34.89 20.68 35 20.59Q35.11 20.5 35.34 20.5H37.73Q37.97 20.5 38.08 20.59Q38.19 20.68 38.19 20.84Q38.19 20.96 38.12 21.04Q38.04 21.11 37.87 21.19L37.59 21.29Q37.36 21.39 37.2 21.6Q37.05 21.8 36.9 22.25L34.43 29.52Q34.34 29.79 34.3 29.95Q34.26 30.12 34.26 30.29V30.63Q34.26 30.81 34.16 30.91Q34.05 31 33.89 31H32.04Q31.88 31 31.78 30.91Q31.67 30.81 31.67 30.62V30.28Q31.67 30.15 31.64 30.01Q31.6 29.87 31.53 29.68L28.79 21.81Q28.71 21.58 28.62 21.48Q28.53 21.38 28.36 21.31L28.07 21.21Q27.79 21.09 27.79 20.84Q27.79 20.68 27.9 20.59Q28.02 20.5 28.25 20.5H31.84Q32.07 20.5 32.18 20.59Q32.3 20.68 32.3 20.84Q32.3 20.98 32.22 21.06Q32.14 21.13 31.97 21.19L31.48 21.3Q31.29 21.36 31.25 21.5Q31.2 21.64 31.31 21.96L33.98 29.71L33.27 30.25L36.03 22.18Q36.15 21.82 36.07 21.62Q35.99 21.41 35.64 21.29L35.21 21.19Q35.06 21.13 34.97 21.06Q34.89 20.98 34.89 20.84Z" fill="#1B1530" />
      <path d="M17 36h26M17 40h20M17 44h24M17 48h10" stroke="#1B1530" strokeWidth="1.6" strokeLinecap="round" />
      <rect x="30" y="49" width="18" height="8" rx="2" fill="#E8453C" />
      <text x="39" y="55.2" textAnchor="middle" fontFamily="ui-sans-serif, system-ui, sans-serif" fontWeight="700" fontSize="5.6" fill="#fff">PDF</text>
    </>}
  </g>;
}

function Basket({ full = false }: { full?: boolean }) {
  const name = full ? 'trash-full' : 'trash';
  return <>
    <defs><pattern id={`p-${name}-weave`} width="8" height="7" patternUnits="userSpaceOnUse">
      <path d="M0 .8h8M.8 0v7" stroke="#A8834A" strokeWidth="1.6" />
    </pattern></defs>
    {full && <>
      <rect x="21" y="9" width="16" height="22" rx="1.5" fill="#FFFDF8" stroke="#1B1530" strokeWidth="3" transform="rotate(-12 29 20)" />
      <rect x="31" y="8" width="15" height="22" rx="1.5" fill="#FFFDF8" stroke="#1B1530" strokeWidth="3" transform="rotate(9 38 19)" />
    </>}
    <path d="M12 25h40l-5 29a4 4 0 0 1-4 3H21a4 4 0 0 1-4-3Z" fill="#E9C98A" stroke="#1B1530" strokeWidth="3" />
    <path d="M12 25h40l-5 29a4 4 0 0 1-4 3H21a4 4 0 0 1-4-3Z" fill={`url(#p-${name}-weave)`} />
    <rect x="9" y="21" width="46" height="6" rx="3" fill="#7A4F00" stroke="#1B1530" strokeWidth="3" />
    <path d="M12 22.5h40" stroke="#E9C98A" />
  </>;
}

function Folder({ writing = false }: { writing?: boolean }) {
  return <>
    <path d="M7 17a4 4 0 0 1 4-4h12.5l4 4H53a4 4 0 0 1 4 4v6H7Z" fill={writing ? '#FFF7E8' : '#FF8A3D'} stroke="#1B1530" strokeWidth="3" />
    <rect x="5" y="21" width="54" height="32" rx="4" fill={writing ? '#FFFDF8' : '#FF8A3D'} stroke="#1B1530" strokeWidth="3" />
    {writing ? <text x="32" y="44" textAnchor="middle" fontFamily={writingFont} fontWeight="400" fontSize="19" fill="#1B1530" opacity=".55">Aa</text>
      : <g transform="translate(13 20) scale(.6)"><Stack folder /></g>}
  </>;
}

function Postcard({ x, y }: { x: number; y: number }) {
  return <>
    <rect x={x} y={y} width="42" height="29" rx="3" fill="#FFE27A" stroke="#1B1530" strokeWidth="3" />
    <rect x={x + 30} y={y + 4} width="8" height="10" rx="1" fill="#FF7EB6" />
    <path d={`M${x + 22} ${y + 18}h14m-14 4h11`} stroke="#1B1530" strokeWidth="1.4" />
  </>;
}

export const APP_ICON_SYMBOLS: Record<AppIconId, JSX.Element> = {
  'app-projects': <symbol id="app-projects" viewBox="0 0 64 64"><Tile fill="#FF8A3D" /><Stack /></symbol>,
  'app-about': AboutSymbol({}),
  'app-writing': <symbol id="app-writing" viewBox="0 0 64 64">
    <Tile fill="#FFFDF8" />
    <path d="M15 10v44" stroke="#E8453C" />
    <path d="M21 39h29M21 45h29M21 51h20" stroke="#1B1530" strokeWidth="1.4" />
    <text x="19" y="32" fontFamily={writingFont} fontWeight="400" fontSize="24" fill="#1B1530">Aa</text>
  </symbol>,
  'app-messages': <symbol id="app-messages" viewBox="0 0 64 64">
    <Tile fill="#FF7EB6" />
    <path d="M18 14h28a9 9 0 0 1 9 9v14a9 9 0 0 1-9 9H27L14 55V45a9 9 0 0 1-5-8V23a9 9 0 0 1 9-9Z" fill="#FFF7E8" stroke="#1B1530" strokeWidth="3" />
    <path d="M22 30h.01M32 30h.01M42 30h.01" stroke="#1B1530" strokeWidth="5" strokeLinecap="round" />
  </symbol>,
  'app-terminal': <symbol id="app-terminal" viewBox="0 0 64 64">
    <Tile fill="#1B1530" />
    <path d="M5 14.5h54" stroke="#655B7D" />
    <text x="11" y="42" fontFamily={monoFont} fontWeight="700" fontSize="22" fontStretch="87.5%" fill="#FFC93C">{'>_'}</text>
    <rect x="43" y="27" width="8" height="15" fill="#FFC93C" opacity=".7" />
  </symbol>,
  'app-maps': <symbol id="app-maps" viewBox="0 0 64 64">
    <Tile fill="#3DBE6B" />
    <defs><pattern id="p-maps-dots" width="3" height="3" patternUnits="userSpaceOnUse" patternTransform="scale(2.272727)"><circle cx="1.5" cy="1.5" r=".9" fill="#FFF7E8" /></pattern></defs>
    <path d={ISLAND_PATH} transform="translate(19.9 10) scale(.44)" fill="url(#p-maps-dots)" stroke="#FFF7E8" strokeWidth="1.3" />
    <path d="M19.1 40.1a3.2 3.2 0 1 1 6.4 0c0 2.5-3.2 5.7-3.2 5.7s-3.2-3.2-3.2-5.7Z" fill="#E8453C" stroke="#1B1530" strokeWidth="3" />
    <circle cx="22.3" cy="40" r="1" fill="#fff" />
  </symbol>,
  'app-activity': <symbol id="app-activity" viewBox="0 0 64 64">
    <Tile fill="#FFC93C" />
    <path d="M9 51h48" stroke="#1B1530" />
    {[40, 34, 28, 22, 16].map((top, index) => {
      const x = 10 + index * 9;
      return <g key={x}>
        <path d={`M${x} ${top}h6v${50 - top}h-6Z`} fill="#1B1530" />
        <path d={`M${x + 6} ${top}l3-2v${50 - top}l-3 2Z`} fill="#1B1530" />
        <path d={`M${x} ${top}l3-2h6l-3 2Z`} fill="#1B1530" />
      </g>;
    })}
  </symbol>,
  'app-cv': <symbol id="app-cv" viewBox="0 0 64 64"><Tile fill="#FFFDF8" /><Page /></symbol>,
  'app-settings': <symbol id="app-settings" viewBox="0 0 64 64">
    <Tile fill="#E8453C" />
    <path d="M28 11h8l1 6 4 2 5-3 6 6-3 5 2 4 6 1v8l-6 1-2 4 3 5-6 6-5-3-4 2-1 6h-8l-1-6-4-2-5 3-6-6 3-5-2-4-6-1v-8l6-1 2-4-3-5 6-6 5 3 4-2ZM38 36a6 6 0 1 0-12 0 6 6 0 0 0 12 0Z" transform="translate(0 -4)" fill="#FFF7E8" stroke="#1B1530" strokeWidth="3" fillRule="evenodd" />
  </symbol>,
  'app-now': <symbol id="app-now" viewBox="0 0 64 64">
    <Tile fill="#FFE27A" />
    <path d="M32 21v7" stroke="#7A4F00" strokeWidth="1.6" />
    <circle cx="32" cy="17" r="5" fill="#E8453C" /><path d="M30 14h3" stroke="#FFF7E8" strokeLinecap="round" />
    <path d="M18 33h28M18 40h28M18 47h18" stroke="#1B1530" strokeWidth="2.5" strokeLinecap="round" />
  </symbol>,
  'app-readme': <symbol id="app-readme" viewBox="0 0 64 64"><Page desktop readme /></symbol>,
  'app-trash': <symbol id="app-trash" viewBox="0 0 64 64"><Basket /></symbol>,
  'app-trash-full': <symbol id="app-trash-full" viewBox="0 0 64 64"><Basket full /></symbol>,
  'app-pin': <symbol id="app-pin" viewBox="0 0 64 64">
    <g transform="rotate(-6 32 33)">
      <rect x="7" y="16" width="50" height="34" rx="3" fill="#FFFDF8" stroke="#1B1530" strokeWidth="3" />
      <rect x="44" y="20" width="9" height="11" rx="1" fill="#FF8A3D" />
      <rect x="45.5" y="21.5" width="6" height="8" rx=".5" fill="none" stroke="#FFFDF8" strokeDasharray="1 1" />
      <path d={ISLAND_PATH} transform="translate(15 20) scale(.26)" fill="#1B1530" />
      <path d="M33 27h7M33 32h7M33 37h5" stroke="#1B1530" strokeWidth="1.4" strokeLinecap="round" />
    </g>
    <path d="M38 38a5 5 0 1 1 10 0c0 3.8-5 8.5-5 8.5s-5-4.7-5-8.5Z" fill="#E8453C" stroke="#fff" strokeWidth="1.2" />
    <circle cx="43" cy="38" r="1.7" fill="#fff" />
  </symbol>,
  'app-guestbook': <symbol id="app-guestbook" viewBox="0 0 64 64">
    <Tile fill="#FFE27A" />
    <g transform="rotate(-10 30 30)"><Postcard x={9} y={12} /></g>
    <g transform="rotate(6 33 37)"><Postcard x={13} y={24} /></g>
  </symbol>,
  'folder-projects': <symbol id="folder-projects" viewBox="0 0 64 64"><Folder /></symbol>,
  'folder-writing': <symbol id="folder-writing" viewBox="0 0 64 64"><Folder writing /></symbol>,
  'doc-cv': <symbol id="doc-cv" viewBox="0 0 64 64"><Page desktop /></symbol>,
  'link-github': <symbol id="link-github" viewBox="0 0 64 64">
    <Tile fill="#1B1530" />
    {/* Official GitHub Invertocat mark. */}
    <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0 0 16 8c0-4.42-3.58-8-8-8Z" transform="translate(14 14) scale(2.25)" fill="#fff" />
  </symbol>,
  'link-linkedin': <symbol id="link-linkedin" viewBox="0 0 64 64">
    <Tile fill="#0A66C2" />
    {/* LinkedIn's official 'in' glyph, without the surrounding brand square. */}
    <path d="M18 27h6.5v19H18Zm3.25-10.2a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4ZM29.5 27h6.1v2.6c.9-1.6 2.9-3.1 5.9-3.1 5.2 0 6.3 3.4 6.3 7.8V46h-6.4v-9.9c0-2.4-.4-4.2-2.8-4.2-2.5 0-3 1.9-3 4.1V46h-6.1Z" fill="#fff" />
  </symbol>,
  'link-prabhava': <symbol id="link-prabhava" viewBox="0 0 64 64">
    <Tile fill="#FFF7E8" />
    <text x="32" y="43" textAnchor="middle" fontFamily={sinhalaFont} fontWeight="600" fontSize="30" fill="#1B1530" lang="si">ප</text>
  </symbol>,
};

/** Mount once inside the document's non-displayed SVG; no hydration needed. */
export function AppIconSymbols({ avatarUrl }: { avatarUrl?: string }) {
  return <>{Object.entries(APP_ICON_SYMBOLS).map(([id, symbol]) =>
    cloneElement(id === 'app-about' && avatarUrl ? AboutSymbol({ avatarUrl }) : symbol, { key: id }))}</>;
}

/** The symbol sprite must be present in the same document. */
export function AppIcon({ id, ...props }: SVGProps<SVGSVGElement> & { id: AppIconId }) {
  return <svg viewBox="0 0 64 64" aria-hidden={props['aria-label'] || props['aria-labelledby'] ? undefined : true} focusable="false" {...props}>
    <use href={`#${id}`} />
  </svg>;
}
