// ==============================================================================
// ExamSphere – Department Repository
// ==============================================================================

import { prisma } from '../../config/db.js';

export class DepartmentRepository {
  async findAll({ search = '', page = 1, limit = 10, isActive }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    const [departments, total] = await Promise.all([
      prisma.department.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
        include: {
          _count: {
            select: {
              users: true,
              courses: true,
            },
          },
        },
      }),
      prisma.department.count({ where }),
    ]);

    return {
      departments,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    return prisma.department.findUnique({
      where: { id },
      include: {
        _count: {
          select: { users: true, courses: true },
        },
        courses: {
          select: { id: true, code: true, title: true, credits: true },
        },
      },
    });
  }

  async findByCode(code) {
    return prisma.department.findUnique({ where: { code } });
  }

  async findByName(name) {
    return prisma.department.findUnique({ where: { name } });
  }

  async create(data) {
    return prisma.department.create({ data });
  }

  async update(id, data) {
    return prisma.department.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return prisma.department.delete({ where: { id } });
  }
}

export const departmentRepository = new DepartmentRepository();
