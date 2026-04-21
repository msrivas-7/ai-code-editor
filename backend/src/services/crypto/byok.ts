import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";
import { config } from "../../config.js";

// AES-256-GCM envelope for user-supplied OpenAI keys. GCM gives us
// confidentiality + authenticity in one shot — the 16-byte auth tag is
// appended to the ciphertext on encrypt, split off and verified on decrypt,
// so a tampered cipher column throws instead of returning garbage.
//
// The master key lives in BYOK_ENCRYPTION_KEY (32 raw bytes, base64-encoded
// at rest in .env). Rotation plan for later: re-encrypt every row under the
// new key inside a single transaction; no rotation hook today because we
// have five test users.

const ALGO = "aes-256-gcm";
const IV_BYTES = 12; // GCM standard nonce length
const TAG_BYTES = 16;

let cachedKey: Buffer | null = null;

function masterKey(): Buffer {
  if (cachedKey) return cachedKey;
  const raw = config.byokEncryptionKey;
  if (!raw) {
    // Should never reach here — assertConfigValid() gates on this at boot.
    throw new Error("[byok] BYOK_ENCRYPTION_KEY not configured");
  }
  const buf = Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error(
      `[byok] BYOK_ENCRYPTION_KEY must decode to 32 bytes (got ${buf.length})`,
    );
  }
  cachedKey = buf;
  return buf;
}

export function encryptKey(plaintext: string): {
  cipher: Buffer;
  nonce: Buffer;
} {
  const nonce = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGO, masterKey(), nonce);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return { cipher: Buffer.concat([encrypted, tag]), nonce };
}

export function decryptKey(cipher: Buffer, nonce: Buffer): string {
  if (cipher.length <= TAG_BYTES) {
    throw new Error("[byok] ciphertext too short to contain auth tag");
  }
  const tag = cipher.subarray(cipher.length - TAG_BYTES);
  const body = cipher.subarray(0, cipher.length - TAG_BYTES);
  const decipher = createDecipheriv(ALGO, masterKey(), nonce);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(body), decipher.final()]).toString(
    "utf8",
  );
}
