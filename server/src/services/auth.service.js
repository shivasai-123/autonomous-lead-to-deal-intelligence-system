import getPrismaClient from '../config/prisma.js';
import { hashPassword, comparePassword } from '../utils/password.js';
import { generateToken } from '../utils/token.js';

const prisma = getPrismaClient();

/**
 * Format a user database record into a safe, non-sensitive object.
 * Strips passwordHash and internal secrets.
 */
export function formatSafeUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    role: typeof user.role === 'object' ? user.role?.name : user.role,
    isActive: user.isActive,
    createdAt: user.createdAt
  };
}

export class AuthService {
  /**
   * Register a new user account.
   * Public registration always assigns the default role SALES_REPRESENTATIVE.
   */
  static async register({ firstName, lastName, email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Check if email is already registered
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail }
    });

    if (existingUser) {
      const error = new Error('An account with this email address already exists');
      error.statusCode = 409;
      throw error;
    }

    // 2. Fetch default role: SALES_REPRESENTATIVE
    const defaultRole = await prisma.role.findUnique({
      where: { name: 'SALES_REPRESENTATIVE' }
    });

    if (!defaultRole) {
      const error = new Error('Default role SALES_REPRESENTATIVE not initialized');
      error.statusCode = 500;
      throw error;
    }

    // 3. Hash password
    const passwordHash = await hashPassword(password);

    // 4. Create user record
    const user = await prisma.user.create({
      data: {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: normalizedEmail,
        passwordHash,
        roleId: defaultRole.id,
        isActive: true
      },
      include: { role: true }
    });

    // 5. Generate authentication token
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: defaultRole.name
    });

    return {
      user: formatSafeUser(user),
      token
    };
  }

  /**
   * Authenticate a user with email and password.
   */
  static async login({ email, password }) {
    const normalizedEmail = email.trim().toLowerCase();

    // 1. Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { role: true }
    });

    if (!user) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // 2. Verify account is active
    if (!user.isActive) {
      const error = new Error('Account is deactivated. Please contact an administrator.');
      error.statusCode = 403;
      throw error;
    }

    // 3. Verify password
    const isPasswordValid = await comparePassword(password, user.passwordHash);
    if (!isPasswordValid) {
      const error = new Error('Invalid email or password');
      error.statusCode = 401;
      throw error;
    }

    // 4. Issue JWT
    const token = generateToken({
      id: user.id,
      email: user.email,
      role: user.role.name
    });

    return {
      user: formatSafeUser(user),
      token
    };
  }

  /**
   * Retrieve the current authenticated user profile.
   */
  static async getCurrentUser(userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user || !user.isActive) {
      const error = new Error('User not found or inactive');
      error.statusCode = 401;
      throw error;
    }

    return formatSafeUser(user);
  }
}
