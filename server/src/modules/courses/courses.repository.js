// ==============================================================================
// ExamSphere – Course Repository
// ==============================================================================

import { prisma } from '../../config/db.js';

export class CourseRepository {
  async findAll({ search = '', departmentId, page = 1, limit = 10, isActive }) {
    const skip = (page - 1) * limit;
    const where = {};

    if (search) {
      where.OR = [
        { code: { contains: search, mode: 'insensitive' } },
        { title: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (departmentId) {
      where.departmentId = departmentId;
    }

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    const [courses, total] = await Promise.all([
      prisma.course.findMany({
        where,
        skip,
        take: limit,
        orderBy: { code: 'asc' },
        include: {
          department: {
            select: { id: true, name: true, code: true },
          },
          facultyMembers: {
            include: {
              faculty: {
                select: { id: true, name: true, email: true },
              },
            },
          },
          _count: {
            select: {
              enrolledStudents: true,
              questions: true,
              exams: true,
            },
          },
        },
      }),
      prisma.course.count({ where }),
    ]);

    return {
      courses,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id) {
    return prisma.course.findUnique({
      where: { id },
      include: {
        department: true,
        facultyMembers: {
          include: {
            faculty: {
              select: { id: true, name: true, email: true, role: true },
            },
          },
        },
        _count: {
          select: {
            enrolledStudents: true,
            questions: true,
            exams: true,
          },
        },
      },
    });
  }

  async findByCode(code) {
    return prisma.course.findUnique({ where: { code } });
  }

  async create(data) {
    return prisma.course.create({
      data,
      include: { department: true },
    });
  }

  async update(id, data) {
    return prisma.course.update({
      where: { id },
      data,
      include: { department: true },
    });
  }

  async delete(id) {
    return prisma.course.delete({ where: { id } });
  }

  async assignFaculty(courseId, facultyId, isCoordinator = false) {
    return prisma.courseFaculty.upsert({
      where: {
        courseId_facultyId: { courseId, facultyId },
      },
      update: { isCoordinator },
      create: { courseId, facultyId, isCoordinator },
      include: {
        faculty: { select: { id: true, name: true, email: true } },
      },
    });
  }

  async removeFaculty(courseId, facultyId) {
    return prisma.courseFaculty.delete({
      where: {
        courseId_facultyId: { courseId, facultyId },
      },
    });
  }
}

export const courseRepository = new CourseRepository();
