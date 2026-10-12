/** Hash both tokens to fixed-length buffers, then compare every byte. No early
 * exit on token contents or lengths. Missing secrets always deny access.
 */
export async function isAdmin(request: Request, secret?: string): Promise<boolean> {
  if (!secret) return false;
  const header = request.headers.get('authorization') ?? '';
  const supplied = /^Bearer (\S+)$/i.exec(header)?.[1] ?? '';
  const digest = async (text: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)));
  const [a, b] = await Promise.all([digest(supplied), digest(secret)]);
  let difference = 0; for (let i = 0; i < a.length; i++) difference |= a[i]! ^ b[i]!;
  return difference === 0 && supplied.length > 0;
}
