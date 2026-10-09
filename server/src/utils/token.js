import jwt from 'jsonwebtoken';
import { env } from '../config/environment.js';

/**
 * Generate a signed JSON Web Token containing minimal necessary claims.
 * @param {object} payload - Claims { id, email, role }
 * @returns {string} Signed JWT
 */
export function generateToken(payload) {
  return jwt.sign(
    {
      id: payload.id,
      email: payload.email,
      role: payload.role
    },
    env.JWT_SECRET,
    {
      expiresIn: env.JWT_EXPIRES_IN
    }
  );
}

/**
 * Verify a JSON Web Token against JWT_SECRET.
 * @param {string} token - Bearer JWT string
 * @returns {object} Decoded payload
 */
export function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}
