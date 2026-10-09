import bcrypt from 'bcryptjs';

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password using bcrypt with cost factor 12.
 * @param {string} password - Plaintext password
 * @returns {Promise<string>} Password hash
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a plaintext password with a stored hash.
 * @param {string} password - Plaintext password
 * @param {string} hash - Stored password hash
 * @returns {Promise<boolean>} True if match
 */
export async function comparePassword(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compare(password, hash);
}
