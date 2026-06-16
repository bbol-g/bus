const SECRET = process.env.AUTH_SECRET || process.env.ACCESS_PASSWORD || 'dev-secret';

async function sign(payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAuthToken(): Promise<string> {
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30;
  const payload = `v1:${exp}`;
  return `${payload}.${await sign(payload)}`;
}

export async function verifyAuthToken(token: string): Promise<boolean> {
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return false;
  if ((await sign(payload)) !== sig) return false;
  const [version, expRaw] = payload.split(':');
  const exp = Number(expRaw);
  if (version !== 'v1' || !Number.isFinite(exp)) return false;
  if (Date.now() > exp) return false;
  return true;
}
