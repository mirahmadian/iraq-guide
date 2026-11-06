/* scrypt برای رمزهای قدیمی سامانه (ساخته‌شده روی سرور 188 با crypto.scryptSync، N=16384 r=8 p=1) — بعد از اولین ورود موفق به PBKDF2 تبدیل می‌شوند */
/* scrypt (N, r=8, p=1, dkLen) in plain JS; outer PBKDF2 steps via WebCrypto */
const R = (a, b) => (a << b) | (a >>> (32 - b));
function salsa(B, x) {
  for (let i = 0; i < 16; i++) x[i] = B[i];
  for (let i = 0; i < 8; i += 2) {
    x[4] ^= R(x[0] + x[12], 7); x[8] ^= R(x[4] + x[0], 9); x[12] ^= R(x[8] + x[4], 13); x[0] ^= R(x[12] + x[8], 18);
    x[9] ^= R(x[5] + x[1], 7); x[13] ^= R(x[9] + x[5], 9); x[1] ^= R(x[13] + x[9], 13); x[5] ^= R(x[1] + x[13], 18);
    x[14] ^= R(x[10] + x[6], 7); x[2] ^= R(x[14] + x[10], 9); x[6] ^= R(x[2] + x[14], 13); x[10] ^= R(x[6] + x[2], 18);
    x[3] ^= R(x[15] + x[11], 7); x[7] ^= R(x[3] + x[15], 9); x[11] ^= R(x[7] + x[3], 13); x[15] ^= R(x[11] + x[7], 18);
    x[1] ^= R(x[0] + x[3], 7); x[2] ^= R(x[1] + x[0], 9); x[3] ^= R(x[2] + x[1], 13); x[0] ^= R(x[3] + x[2], 18);
    x[6] ^= R(x[5] + x[4], 7); x[7] ^= R(x[6] + x[5], 9); x[4] ^= R(x[7] + x[6], 13); x[5] ^= R(x[4] + x[7], 18);
    x[11] ^= R(x[10] + x[9], 7); x[8] ^= R(x[11] + x[10], 9); x[9] ^= R(x[8] + x[11], 13); x[10] ^= R(x[9] + x[8], 18);
    x[12] ^= R(x[15] + x[14], 7); x[13] ^= R(x[12] + x[15], 9); x[14] ^= R(x[13] + x[12], 13); x[15] ^= R(x[14] + x[13], 18);
  }
  for (let i = 0; i < 16; i++) B[i] = (B[i] + x[i]) | 0;
}
function blockMix(B, Y, r, x) {
  const X = B.subarray((2 * r - 1) * 16, 2 * r * 16).slice(), T = new Int32Array(16);
  for (let i = 0; i < 2 * r; i++) {
    for (let j = 0; j < 16; j++) T[j] = X[j] ^ B[i * 16 + j];
    salsa(T, x); X.set(T);
    Y.set(T, ((i & 1) * r + (i >> 1)) * 16);
  }
  B.set(Y);
}
async function pbkdf2(pw, salt, len) {
  const k = await crypto.subtle.importKey('raw', pw, 'PBKDF2', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 1 }, k, len * 8));
}
export async function scrypt(pw, salt, N = 16384, r = 8, dkLen = 32) {
  const te = new TextEncoder(), P = te.encode(pw), S = te.encode(salt);
  const b = await pbkdf2(P, S, 128 * r);
  const n = 32 * r, B = new Int32Array(n), V = new Int32Array(N * n), Y = new Int32Array(n), x = new Int32Array(16);
  const dv = new DataView(b.buffer);
  for (let i = 0; i < n; i++) B[i] = dv.getInt32(i * 4, true);
  for (let i = 0; i < N; i++) { V.set(B, i * n); blockMix(B, Y, r, x); }
  for (let i = 0; i < N; i++) {
    const j = B[(2 * r - 1) * 16] & (N - 1);
    for (let k = 0; k < n; k++) B[k] ^= V[j * n + k];
    blockMix(B, Y, r, x);
  }
  for (let i = 0; i < n; i++) dv.setInt32(i * 4, B[i], true);
  return pbkdf2(P, b, dkLen);
}
