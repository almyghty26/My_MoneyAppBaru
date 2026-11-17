export const DEFAULT_PBKDF2_ITERATIONS = 120_000;

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i += 1) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

export function generateRandomSaltHex(byteLength = 16): string {
  const bytes = new Uint8Array(byteLength);
  if (typeof globalThis.crypto !== 'undefined' && typeof globalThis.crypto.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < byteLength; i += 1) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }
  return bytesToHex(bytes);
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function deriveSecretHashPBKDF2(
  secret: string,
  saltHex: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) {
    throw new Error(
      'Web Crypto API tidak tersedia di lingkungan browser ini (diperlukan HTTPS atau localhost).'
    );
  }

  const encoder = new TextEncoder();
  const keyMaterial = await subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );

  const saltBytes = hexToBytes(saltHex);
  const derivedBits = await subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: saltBytes.buffer as ArrayBuffer,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );

  return bytesToHex(new Uint8Array(derivedBits));
}

export async function hashSecret(secret: string): Promise<{
  hash: string;
  salt: string;
  iterations: number;
}> {
  const salt = generateRandomSaltHex(16);
  const iterations = DEFAULT_PBKDF2_ITERATIONS;
  const hash = await deriveSecretHashPBKDF2(secret, salt, iterations);
  return { hash, salt, iterations };
}

export async function verifySecret(
  candidate: string,
  expectedHash: string,
  saltHex: string,
  iterations: number = DEFAULT_PBKDF2_ITERATIONS
): Promise<boolean> {
  if (!expectedHash || !saltHex) return false;
  const candidateHash = await deriveSecretHashPBKDF2(candidate, saltHex, iterations);
  return timingSafeEqualHex(candidateHash, expectedHash);
}

export function validatePasswordStrength(password: string): {
  valid: boolean;
  error?: string;
} {
  if (!password || password.length < 6) {
    return { valid: false, error: 'Password minimal harus 6 karakter.' };
  }
  if (password.length > 128) {
    return { valid: false, error: 'Password maksimal 128 karakter.' };
  }
  return { valid: true };
}

export function validatePinFormat(pin: string): {
  valid: boolean;
  error?: string;
} {
  const trimmed = pin.trim();
  if (!/^\d{4,6}$/.test(trimmed)) {
    return { valid: false, error: 'PIN keamanan harus berupa 4 hingga 6 digit angka.' };
  }
  return { valid: true };
}
