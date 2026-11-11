// ==============================================================================
// ExamSphere – User Management Repository
// ==============================================================================

import { prisma } from '../../config/db.js';

export class UserRepository {
  async findAll({
    role,
    departmentId,
    batch,
    section,
    isActive,
    search = '',
    page = 1,
    limit = 10,
    includeDeleted = false,
  }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (!includeDeleted) {
      where.deletedAt = null;
    }

    if (role) {
      where.role = role;
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (batch) {
      where.batch = batch;
    }

    if (section) {
      where.section = section;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { rollNumber: { contains: search, mode: 'insensitive' } },
        { employeeId: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          department: {
            select: { id: true, name: true, code: true },
          },
          employeeId: true,
          designation: true,
          rollNumber: true,
          batch: true,
          section: true,
          avatarUrl: true,
          isActive: true,
          isDemo: true,
          isEmailVerified: true,
          createdAt: true,
          updatedAt: true,
          _count: {
            select: {
              facultyCourses: true,
              studentEnrollments: true,
              attempts: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    return prisma.user.findUnique({
      where: { id },
      include: {
        department: true,
        facultyCourses: {
          include: { course: true },
        },
        studentEnrollments: {
          include: { course: true },
        },
      },
    });
  }

  async findByEmail(email) {
    return prisma.user.findUnique({ where: { email } });
  }

  async findByRollNumber(rollNumber) {
    if (!rollNumber) return null;
    return prisma.user.findUnique({ where: { rollNumber } });
  }

  async findByEmployeeId(employeeId) {
    if (!employeeId) return null;
    return prisma.user.findUnique({ where: { employeeId } });
  }

  async create(data) {
    return prisma.user.create({
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        employeeId: true,
        designation: true,
        rollNumber: true,
        batch: true,
        section: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        createdAt: true,
      },
    });
  }

  async update(id, data) {
    return prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        departmentId: true,
        department: {
          select: { id: true, name: true, code: true },
        },
        employeeId: true,
        designation: true,
        rollNumber: true,
        batch: true,
        section: true,
        isActive: true,
        isDemo: true,
        isEmailVerified: true,
        updatedAt: true,
      },
    });
  }

  /**
   * Soft delete user to preserve academic record integrity
   */
  async delete(id) {
    return prisma.user.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });
  }

  /**
   * Bulk insert students inside a single atomic database transaction
   */
  async bulkCreateStudents(studentsList) {
    return prisma.$transaction(async (tx) => {
      const createdStudents = [];
      for (const item of studentsList) {
        const student = await tx.user.create({
          data: item,
          select: {
            id: true,
            name: true,
            email: true,
            rollNumber: true,
            batch: true,
            section: true,
          },
        });
        createdStudents.push(student);
      }
      return createdStudents;
    });
  }

  /**
   * Get all student records for CSV export
   */
  async exportStudents({ departmentId, batch, section }) {
    const where = { role: 'STUDENT', deletedAt: null };
    if (departmentId) where.departmentId = departmentId;
    if (batch) where.batch = batch;
    if (section) where.section = section;

    return prisma.user.findMany({
      where,
      orderBy: { rollNumber: 'asc' },
      select: {
        rollNumber: true,
        name: true,
        email: true,
        department: { select: { code: true, name: true } },
        batch: true,
        section: true,
        isActive: true,
        createdAt: true,
      },
    });
  }
}

export const userRepository = new UserRepository();
