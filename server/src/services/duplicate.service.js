import { getPrismaClient } from '../config/prisma.js';

const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  '10minutemail.com',
  'tempmail.com',
  'throwawaymail.com',
  'guerrillamail.com',
  'sharklasers.com',
  'trashmail.com',
  'yopmail.com',
  'dispostable.com',
  'getairmail.com'
]);

const PUBLIC_EMAIL_PROVIDERS = new Set([
  'gmail.com',
  'yahoo.com',
  'hotmail.com',
  'outlook.com',
  'icloud.com',
  'aol.com',
  'protonmail.com',
  'zoho.com',
  'mail.com',
  'live.com',
  'msn.com'
]);

export class DuplicateService {
  /**
   * Normalize email address: trim and lowercase.
   * @param {string} email
   * @returns {string}
   */
  static normalizeEmail(email) {
    if (!email || typeof email !== 'string') return '';
    return email.trim().toLowerCase();
  }

  /**
   * Normalize phone number to canonical digits for comparison while preserving country code.
   * Standardizes e.g. "+1 (555) 019-2834" -> "15550192834"
   * @param {string|null} phone
   * @returns {string|null}
   */
  static normalizePhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const trimmed = phone.trim();
    if (!trimmed) return null;

    // Retain all digits (preserves country code numbers)
    const digitsOnly = trimmed.replace(/\D/g, '');
    if (!digitsOnly) return null;

    return digitsOnly;
  }

  /**
   * Compare two phone numbers for equality, accounting for optional country code prefix '1'.
   * @param {string} phone1
   * @param {string} phone2
   * @returns {boolean}
   */
  static isPhoneMatch(phone1, phone2) {
    const norm1 = this.normalizePhone(phone1);
    const norm2 = this.normalizePhone(phone2);
    if (!norm1 || !norm2) return false;

    if (norm1 === norm2) return true;

    // Match 10-digit North American number against 11-digit number with '1' prefix
    if (norm1.length === 11 && norm1.startsWith('1') && norm1.slice(1) === norm2) return true;
    if (norm2.length === 11 && norm2.startsWith('1') && norm2.slice(1) === norm1) return true;

    return false;
  }

  /**
   * Extract corporate domain from email if not a generic public webmail provider.
   * @param {string} email
   * @returns {string|null}
   */
  static extractCorporateDomain(email) {
    const normalized = this.normalizeEmail(email);
    const atIndex = normalized.lastIndexOf('@');
    if (atIndex === -1 || atIndex === normalized.length - 1) return null;

    const domain = normalized.slice(atIndex + 1);
    if (PUBLIC_EMAIL_PROVIDERS.has(domain)) {
      return null; // Public email; not an organizational corporate domain
    }
    return domain;
  }

  /**
   * Evaluate whether contact details trigger basic explainable suspicious patterns.
   *
   * @param {Object} leadData
   * @param {string} leadData.firstName
   * @param {string} leadData.lastName
   * @param {string} leadData.email
   * @param {string|null} [leadData.phone]
   * @returns {{ isSuspicious: boolean, reason: string | null }}
   */
  static evaluateSuspiciousRules({ firstName = '', lastName = '', email = '', phone = null }) {
    const normEmail = this.normalizeEmail(email);
    const atIndex = normEmail.lastIndexOf('@');
    const domain = atIndex !== -1 ? normEmail.slice(atIndex + 1) : '';

    // Rule 1: Disposable email domain
    if (DISPOSABLE_DOMAINS.has(domain)) {
      return {
        isSuspicious: true,
        reason: `Disposable temporary email provider detected (${domain})`
      };
    }

    // Rule 2: Obvious test/placeholder email addresses
    const placeholderEmails = ['test@test.com', 'fake@fake.com', 'admin@admin.com', 'user@user.com', 'asdf@asdf.com'];
    if (placeholderEmails.includes(normEmail)) {
      return {
        isSuspicious: true,
        reason: 'Known placeholder or junk test email address provided'
      };
    }

    // Rule 3: Malformed phone pattern (e.g. under 7 digits or single repeating digit like 00000000)
    if (phone) {
      const normPhone = this.normalizePhone(phone);
      if (normPhone) {
        const digits = normPhone.replace(/\D/g, '');
        if (digits.length > 0 && digits.length < 7) {
          return {
            isSuspicious: true,
            reason: 'Phone number has fewer than 7 digits'
          };
        }
        if (/^(\d)\1+$/.test(digits) && digits.length >= 6) {
          return {
            isSuspicious: true,
            reason: 'Phone number contains repeating single digits'
          };
        }
      }
    }

    // Rule 4: Suspicious name pattern
    const fullName = `${firstName} ${lastName}`.trim().toLowerCase();
    const junkNames = ['test test', 'asdf asdf', 'fake lead', 'unknown user', 'null null'];
    if (junkNames.includes(fullName)) {
      return {
        isSuspicious: true,
        reason: 'Contact name matches known test placeholder pattern'
      };
    }

    return {
      isSuspicious: false,
      reason: null
    };
  }

  /**
   * Search database for duplicate leads and corporate domain associations.
   *
   * @param {Object} params
   * @param {string} params.email
   * @param {string|null} [params.phone]
   * @param {string|null} [params.excludeLeadId] - ID of lead currently being edited
   * @returns {Promise<{
   *   isDuplicate: boolean,
   *   isSuspicious: boolean,
   *   suspiciousReason: string | null,
   *   duplicateMatches: Array,
   *   domainMatches: Array,
   *   reasons: string[]
   * }>}
   */
  static async checkLeadDuplicates({ email, phone = null, excludeLeadId = null }) {
    const prisma = getPrismaClient();
    const normalizedEmail = this.normalizeEmail(email);
    const normalizedPhone = this.normalizePhone(phone);
    const corporateDomain = this.extractCorporateDomain(normalizedEmail);

    const reasons = [];
    const duplicateMatchesMap = new Map();
    const domainMatchesMap = new Map();

    const baseWhere = {
      isArchived: false,
      ...(excludeLeadId ? { id: { not: excludeLeadId } } : {})
    };

    // 1. Check exact email matches (Case-insensitive)
    if (normalizedEmail) {
      const emailMatches = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          email: { equals: normalizedEmail, mode: 'insensitive' }
        },
        include: {
          company: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      for (const lead of emailMatches) {
        duplicateMatchesMap.set(lead.id, {
          id: lead.id,
          firstName: lead.firstName,
          lastName: lead.lastName,
          email: lead.email,
          phone: lead.phone,
          status: lead.status,
          priority: lead.priority,
          company: lead.company ? { id: lead.company.id, name: lead.company.name } : null,
          assignedTo: lead.assignedTo
            ? { id: lead.assignedTo.id, name: `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` }
            : null,
          matchedOn: 'email'
        });
      }

      if (emailMatches.length > 0) {
        reasons.push(`Existing lead found with matching normalized email: ${normalizedEmail}`);
      }
    }

    // 2. Check normalized phone matches (if phone provided)
    if (normalizedPhone) {
      const allLeadsWithPhone = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          phone: { not: null }
        },
        include: {
          company: { select: { id: true, name: true } },
          assignedTo: { select: { id: true, firstName: true, lastName: true, email: true } }
        }
      });

      for (const lead of allLeadsWithPhone) {
        if (this.isPhoneMatch(lead.phone, phone)) {
          if (!duplicateMatchesMap.has(lead.id)) {
            duplicateMatchesMap.set(lead.id, {
              id: lead.id,
              firstName: lead.firstName,
              lastName: lead.lastName,
              email: lead.email,
              phone: lead.phone,
              status: lead.status,
              priority: lead.priority,
              company: lead.company ? { id: lead.company.id, name: lead.company.name } : null,
              assignedTo: lead.assignedTo
                ? { id: lead.assignedTo.id, name: `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` }
                : null,
              matchedOn: 'phone'
            });
            reasons.push(`Existing lead found with matching normalized phone: ${lead.phone}`);
          }
        }
      }
    }

    // 3. Check shared corporate domain (informational relationship warning, NOT an automatic duplicate)
    if (corporateDomain) {
      const domainLeads = await prisma.lead.findMany({
        where: {
          ...baseWhere,
          email: {
            endsWith: `@${corporateDomain}`,
            mode: 'insensitive'
          }
        },
        include: {
          company: { select: { id: true, name: true } }
        },
        take: 10
      });

      for (const lead of domainLeads) {
        // Exclude if already flagged as duplicate by email or phone
        if (!duplicateMatchesMap.has(lead.id)) {
          domainMatchesMap.set(lead.id, {
            id: lead.id,
            firstName: lead.firstName,
            lastName: lead.lastName,
            email: lead.email,
            company: lead.company ? { id: lead.company.id, name: lead.company.name } : null,
            corporateDomain
          });
        }
      }
    }

    const duplicateMatches = Array.from(duplicateMatchesMap.values());
    const domainMatches = Array.from(domainMatchesMap.values());
    const isDuplicate = duplicateMatches.length > 0;

    return {
      isDuplicate,
      duplicateMatches,
      domainMatches,
      reasons
    };
  }
}

export default DuplicateService;
