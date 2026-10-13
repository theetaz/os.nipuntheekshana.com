interface WidgetOptions {
  sitekey: string; action: string; execution: 'execute'; appearance: 'interaction-only'; 'response-field': false;
  callback(token: string): void; 'expired-callback'(): void; 'error-callback'(): void; 'timeout-callback'(): void;
}
export interface Turnstile { render(element: HTMLElement, options: WidgetOptions): string; remove(id: string): void; execute(id: string): void; reset(id: string): void }
declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<Turnstile> | undefined;
export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    const timer = setTimeout(() => fail(), 15000);
    const fail = () => { clearTimeout(timer); script.remove(); reject(new Error('Verification unavailable.')); };
    script.onload = () => { clearTimeout(timer); if (window.turnstile) resolve(window.turnstile); else fail(); };
    script.onerror = fail;
    document.head.append(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
