const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export const isUlid = (value: string) => /^[0-7][0-9A-HJKMNP-TV-Z]{25}$/.test(value);
export function ulid(now = Date.now()): string {
  if (!Number.isSafeInteger(now) || now < 0 || now > 281474976710655) throw new Error('Invalid ULID timestamp');
  let time = now; let prefix = '';
  for (let i = 0; i < 10; i++) { prefix = alphabet[time % 32] + prefix; time = Math.floor(time / 32); }
  let random = 0n; for (const byte of crypto.getRandomValues(new Uint8Array(10))) random = (random << 8n) | BigInt(byte);
  let suffix = ''; for (let i = 0; i < 16; i++) { suffix = alphabet[Number(random & 31n)] + suffix; random >>= 5n; }
  return prefix + suffix;
}
