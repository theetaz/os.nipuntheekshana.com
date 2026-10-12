export async function verifyTurnstile(token: string, secret: string, ip: string, origin: string, fetcher: typeof fetch = fetch): Promise<boolean> {
  try {
    const response = await fetcher('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST', body: new URLSearchParams({ secret, response: token, remoteip: ip }), signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return false;
    const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
    // Cloudflare's dummy secret returns a synthetic hostname/action. Never bypass verification.
    const testKey = secret === '1x0000000000000000000000000000000AA';
    return result.success === true && (testKey || (result.hostname === new URL(origin).hostname && result.action === 'postcard'));
  } catch { return false; }
}
export function validOrigin(request: Request): boolean {
  // Production is pinned to the custom domain; local dev is same-origin on loopback.
  const url = new URL(request.url);
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  return request.headers.get('origin') === url.origin && (local || url.origin === 'https://os.nipuntheekshana.com');
}
