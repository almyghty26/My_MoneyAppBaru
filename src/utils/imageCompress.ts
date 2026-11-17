export const ALLOWED_AVATAR_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export const ALLOWED_AVATAR_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'] as const;

const MAX_RAW_AVATAR_BYTES = 10 * 1024 * 1024; // 10 MB
const TARGET_AVATAR_SIZE = 256; // px square

export function isSupportedAvatarFile(file: { name: string; type: string }): boolean {
  const mime = (file.type || '').toLowerCase();
  if ((ALLOWED_AVATAR_MIME_TYPES as readonly string[]).includes(mime)) {
    return true;
  }
  const lowerName = (file.name || '').toLowerCase();
  return ALLOWED_AVATAR_EXTENSIONS.some((ext) => lowerName.endsWith(ext));
}

export function getProfileInitials(displayName: string): string {
  const cleaned = displayName.trim();
  if (!cleaned) return 'MM';
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase();
}

export function validateUsernameFormat(rawUsername: string): {
  valid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = rawUsername.trim().toLowerCase();
  if (!normalized) {
    return { valid: false, normalized, error: 'Username wajib diisi.' };
  }
  if (normalized.length < 3 || normalized.length > 30) {
    return {
      valid: false,
      normalized,
      error: 'Username harus terdiri dari 3 hingga 30 karakter.',
    };
  }
  if (!/^[a-z0-9._-]+$/.test(normalized)) {
    return {
      valid: false,
      normalized,
      error: 'Username hanya boleh menggunakan huruf, angka, titik (.), garis bawah (_), atau tanda hubung (-).',
    };
  }
  return { valid: true, normalized };
}

export interface CompressedAvatarResult {
  dataUrl: string;
  width: number;
  height: number;
  approxBytes: number;
}

export async function compressAvatarImage(file: File): Promise<CompressedAvatarResult> {
  if (!isSupportedAvatarFile(file)) {
    throw new Error('Format foto harus JPG, JPEG, PNG, atau WEBP.');
  }
  if (file.size > MAX_RAW_AVATAR_BYTES) {
    throw new Error('Ukuran file foto maksimal 10 MB.');
  }

  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('File gambar tidak dapat dibaca atau rusak.'));
      el.src = objectUrl;
    });

    const srcW = img.naturalWidth || img.width;
    const srcH = img.naturalHeight || img.height;
    if (!srcW || !srcH) {
      throw new Error('Dimensi gambar tidak valid.');
    }

    // Center-crop square so avatar always looks balanced without distortion
    const cropSize = Math.min(srcW, srcH);
    const sx = Math.floor((srcW - cropSize) / 2);
    const sy = Math.floor((srcH - cropSize) / 2);

    const outSize = Math.min(TARGET_AVATAR_SIZE, cropSize);
    const canvas = document.createElement('canvas');
    canvas.width = outSize;
    canvas.height = outSize;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Canvas tidak tersedia di browser ini.');
    }
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, sx, sy, cropSize, cropSize, 0, 0, outSize, outSize);

    let dataUrl = canvas.toDataURL('image/webp', 0.85);
    if (!dataUrl.startsWith('data:image/webp')) {
      dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    }

    const base64Length = dataUrl.split(',')[1]?.length ?? 0;
    const approxBytes = Math.round((base64Length * 3) / 4);

    return {
      dataUrl,
      width: outSize,
      height: outSize,
      approxBytes,
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
