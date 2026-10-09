import { getPrismaClient } from '../config/prisma.js';
import { AuditService } from './audit.service.js';

export class CompanyService {
  /**
   * List companies with search, pagination, and relation counts.
   */
  static async listCompanies({ search = '', page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'desc' }) {
    const prisma = getPrismaClient();
    const skip = (page - 1) * limit;

    const where = {};
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { industry: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [companies, total] = await Promise.all([
      prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          _count: {
            select: {
              leads: { where: { isArchived: false } },
              deals: true
            }
          }
        }
      }),
      prisma.company.count({ where })
    ]);

    return {
      companies,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1
      }
    };
  }

  /**
   * Retrieve company by ID including associated leads and deals.
   */
  static async getCompanyById(id) {
    const prisma = getPrismaClient();
    const company = await prisma.company.findUnique({
      where: { id },
      include: {
        leads: {
          where: { isArchived: false },
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            jobTitle: true,
            status: true,
            priority: true,
            score: true,
            createdAt: true,
            assignedTo: {
              select: { id: true, firstName: true, lastName: true, email: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        },
        deals: {
          select: {
            id: true,
            title: true,
            value: true,
            currency: true,
            status: true,
            createdAt: true
          },
          orderBy: { createdAt: 'desc' }
        },
        _count: {
          select: {
            leads: { where: { isArchived: false } },
            deals: true
          }
        }
      }
    });

    if (!company) {
      const error = new Error(`Company with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    return company;
  }

  /**
   * Create a new company with duplicate prevention and audit logging.
   */
  static async createCompany(data, actorId) {
    const prisma = getPrismaClient();
    const trimmedName = data.name.trim();

    // Prevent accidental duplication of existing company names
    const existing = await prisma.company.findFirst({
      where: {
        name: { equals: trimmedName, mode: 'insensitive' }
      }
    });

    if (existing) {
      const error = new Error(`A company with the name "${trimmedName}" already exists`);
      error.statusCode = 409;
      error.details = { existingCompanyId: existing.id, existingCompanyName: existing.name };
      throw error;
    }

    const company = await prisma.company.create({
      data: {
        name: trimmedName,
        industry: data.industry ? data.industry.trim() : null,
        website: data.website ? data.website.trim() : null,
        phone: data.phone ? data.phone.trim() : null,
        email: data.email ? data.email.trim().toLowerCase() : null,
        address: data.address ? data.address.trim() : null,
        city: data.city ? data.city.trim() : null,
        country: data.country ? data.country.trim() : null
      }
    });

    await AuditService.log({
      action: 'COMPANY_CREATED',
      entityType: 'Company',
      entityId: company.id,
      userId: actorId,
      metadata: { name: company.name, industry: company.industry }
    });

    return company;
  }

  /**
   * Update an existing company with audit logging.
   */
  static async updateCompany(id, data, actorId) {
    const prisma = getPrismaClient();

    // Verify company exists
    const existing = await prisma.company.findUnique({ where: { id } });
    if (!existing) {
      const error = new Error(`Company with ID "${id}" was not found`);
      error.statusCode = 404;
      throw error;
    }

    // If changing name, verify uniqueness
    if (data.name && data.name.trim().toLowerCase() !== existing.name.toLowerCase()) {
      const nameConflict = await prisma.company.findFirst({
        where: {
          id: { not: id },
          name: { equals: data.name.trim(), mode: 'insensitive' }
        }
      });
      if (nameConflict) {
        const error = new Error(`Another company with the name "${data.name.trim()}" already exists`);
        error.statusCode = 409;
        throw error;
      }
    }

    const updatePayload = {};
    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.industry !== undefined) updatePayload.industry = data.industry ? data.industry.trim() : null;
    if (data.website !== undefined) updatePayload.website = data.website ? data.website.trim() : null;
    if (data.phone !== undefined) updatePayload.phone = data.phone ? data.phone.trim() : null;
    if (data.email !== undefined) updatePayload.email = data.email ? data.email.trim().toLowerCase() : null;
    if (data.address !== undefined) updatePayload.address = data.address ? data.address.trim() : null;
    if (data.city !== undefined) updatePayload.city = data.city ? data.city.trim() : null;
    if (data.country !== undefined) updatePayload.country = data.country ? data.country.trim() : null;

    const updated = await prisma.company.update({
      where: { id },
      data: updatePayload
    });

    await AuditService.log({
      action: 'COMPANY_UPDATED',
      entityType: 'Company',
      entityId: id,
      userId: actorId,
      metadata: { updatedFields: Object.keys(updatePayload) }
    });

    return updated;
  }
}

export default CompanyService;
