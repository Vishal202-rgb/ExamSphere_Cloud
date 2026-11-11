// ==============================================================================
// ExamSphere – Course Service
// Scoped course lifecycle management and instructor assignment
// ==============================================================================

import { courseRepository } from './courses.repository.js';
import { departmentRepository } from '../departments/departments.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { prisma } from '../../config/db.js';

export class CourseService {
  async getCourses(params, requestingUser) {
    const queryParams = { ...params };
    if (requestingUser?.role === 'DEPARTMENT_ADMIN') {
      queryParams.departmentId = requestingUser.departmentId;
    }
    return courseRepository.findAll(queryParams);
  }

  async getCourseById(id) {
    const course = await courseRepository.findById(id);
    if (!course) {
      throw ApiError.notFound(`Course with ID ${id} not found`);
    }
    return course;
  }

  async createCourse(data, adminUser) {
    const adminUserId = typeof adminUser === 'object' ? adminUser.id : adminUser;

    if (adminUser?.role === 'DEPARTMENT_ADMIN') {
      if (data.departmentId && data.departmentId !== adminUser.departmentId) {
        throw ApiError.forbidden('Forbidden: You can only create courses within your assigned department');
      }
      data.departmentId = adminUser.departmentId;
    }

    // Verify department exists
    const dept = await departmentRepository.findById(data.departmentId);
    if (!dept) {
      throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
    }

    const existingCode = await courseRepository.findByCode(data.code);
    if (existingCode) {
      throw ApiError.conflict(`Course code '${data.code}' is already registered`);
    }

    const course = await courseRepository.create(data);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_CREATED',
        resource: 'COURSE',
        resourceId: course.id,
        metadata: { code: course.code, title: course.title, departmentId: course.departmentId },
      },
    }).catch(() => {});

    return course;
  }

  async updateCourse(id, data, adminUser) {
    const adminUserId = typeof adminUser === 'object' ? adminUser.id : adminUser;
    const course = await this.getCourseById(id);

    if (adminUser?.role === 'DEPARTMENT_ADMIN' && course.departmentId !== adminUser.departmentId) {
      throw ApiError.forbidden('Forbidden: You can only update courses in your assigned department');
    }

    if (data.departmentId) {
      if (adminUser?.role === 'DEPARTMENT_ADMIN' && data.departmentId !== adminUser.departmentId) {
        throw ApiError.forbidden('Forbidden: You cannot transfer courses to another department');
      }
      const dept = await departmentRepository.findById(data.departmentId);
      if (!dept) {
        throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
      }
    }

    if (data.code) {
      const existing = await courseRepository.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw ApiError.conflict(`Course code '${data.code}' is already in use`);
      }
    }

    const updated = await courseRepository.update(id, data);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_UPDATED',
        resource: 'COURSE',
        resourceId: id,
        metadata: data,
      },
    }).catch(() => {});

    return updated;
  }

  async deleteCourse(id, adminUser) {
    const adminUserId = typeof adminUser === 'object' ? adminUser.id : adminUser;
    const course = await this.getCourseById(id);

    if (adminUser?.role === 'DEPARTMENT_ADMIN' && course.departmentId !== adminUser.departmentId) {
      throw ApiError.forbidden('Forbidden: You can only delete courses in your assigned department');
    }

    if (course._count?.exams > 0 || course._count?.enrolledStudents > 0) {
      // Soft-deactivate if dependent exam/student records exist
      return courseRepository.update(id, { isActive: false });
    }

    await courseRepository.delete(id);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'COURSE_DELETED',
        resource: 'COURSE',
        resourceId: id,
      },
    }).catch(() => {});

    return { message: 'Course successfully removed' };
  }

  async assignFaculty(courseId, facultyId, isCoordinator, adminUser) {
    const adminUserId = typeof adminUser === 'object' ? adminUser.id : adminUser;
    const course = await this.getCourseById(courseId);

    if (adminUser?.role === 'DEPARTMENT_ADMIN' && course.departmentId !== adminUser.departmentId) {
      throw ApiError.forbidden('Forbidden: You can only assign faculty to courses in your assigned department');
    }

    // Verify faculty user
    const facultyUser = await prisma.user.findUnique({
      where: { id: facultyId },
    });

    if (!facultyUser || facultyUser.role !== 'FACULTY') {
      throw ApiError.badRequest(`User with ID ${facultyId} is not a valid faculty member`);
    }

    if (adminUser?.role === 'DEPARTMENT_ADMIN' && facultyUser.departmentId !== adminUser.departmentId) {
      throw ApiError.badRequest('Faculty member belongs to a different department');
    }

    const assignment = await courseRepository.assignFaculty(courseId, facultyId, isCoordinator);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FACULTY_ASSIGNED_TO_COURSE',
        resource: 'COURSE_FACULTY',
        metadata: { courseId, facultyId, isCoordinator },
      },
    }).catch(() => {});

    return assignment;
  }

  async removeFaculty(courseId, facultyId, adminUser) {
    const adminUserId = typeof adminUser === 'object' ? adminUser.id : adminUser;
    const course = await this.getCourseById(courseId);

    if (adminUser?.role === 'DEPARTMENT_ADMIN' && course.departmentId !== adminUser.departmentId) {
      throw ApiError.forbidden('Forbidden: Course belongs to a different department');
    }

    await courseRepository.removeFaculty(courseId, facultyId);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FACULTY_REMOVED_FROM_COURSE',
        resource: 'COURSE_FACULTY',
        metadata: { courseId, facultyId },
      },
    }).catch(() => {});

    return { message: 'Faculty unassigned from course successfully' };
  }
}

export const courseService = new CourseService();
