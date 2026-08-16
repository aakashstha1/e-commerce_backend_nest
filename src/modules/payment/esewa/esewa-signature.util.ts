import * as crypto from 'crypto';

/**
 * eSewa requires a comma-separated "key=value" message built from exactly the
 * fields listed in `signedFieldNames`, in that order — then HMAC-SHA256'd with
 * the access key and base64-encoded.
 */
export function generateEsewaSignature(
  fields: Record<string, string | number>,
  signedFieldNames: string[],
  accessKey: string,
): string {
  const message = signedFieldNames
    .map((field) => `${field}=${fields[field]}`)
    .join(',');

  return crypto
    .createHmac('sha256', accessKey)
    .update(message)
    .digest('base64');
}

/** Verifies a signature eSewa sent us (e.g. in the callback) against our own computed one. */
export function verifyEsewaSignature(
  fields: Record<string, string | number>,
  signedFieldNames: string[],
  accessKey: string,
  receivedSignature: string,
): boolean {
  const expected = generateEsewaSignature(fields, signedFieldNames, accessKey);
  // Use timing-safe comparison to avoid leaking info via response-time side channels.
  const a = Buffer.from(expected);
  const b = Buffer.from(receivedSignature);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
