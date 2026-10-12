interface WidgetOptions { sitekey: string; action: string; callback(token: string): void; 'expired-callback'(): void; 'error-callback'(): void }
interface Turnstile { render(element: HTMLElement, options: WidgetOptions): string; remove(id: string): void }
declare global { interface Window { turnstile?: Turnstile } }
let loading: Promise<Turnstile> | undefined;
export function loadTurnstile(): Promise<Turnstile> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (!loading) loading = new Promise<Turnstile>((resolve, reject) => {
    const script = document.createElement('script'); script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true;
    script.onload = () => window.turnstile ? resolve(window.turnstile) : reject(new Error('Verification unavailable.'));
    script.onerror = () => { script.remove(); reject(new Error('Verification unavailable.')); };
    document.head.append(script);
  }).catch(error => { loading = undefined; throw error; });
  return loading;
}
