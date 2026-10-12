export const utcDay = (now = Date.now()) => new Date(now).toISOString().slice(0, 10);
export async function hashIp(ip: string, salt: string, day: string): Promise<string> {
  // Delimit components to avoid ambiguous concatenations; raw IPs are never stored.
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${ip}\0${salt}\0${day}`));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}
