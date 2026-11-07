// ==============================================================================
// ExamSphere – Course Service
// ==============================================================================

import { courseRepository } from './courses.repository.js';
import { departmentRepository } from '../departments/departments.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { prisma } from '../../config/db.js';

export class CourseService {
  async getCourses(params) {
    return courseRepository.findAll(params);
  }

  async getCourseById(id) {
    const course = await courseRepository.findById(id);
    if (!course) {
      throw ApiError.notFound(`Course with ID ${id} not found`);
    }
    return course;
  }

  async createCourse(data, adminUserId) {
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
        metadata: { code: course.code, title: course.title },
      },
    }).catch(() => {});

    return course;
  }

  async updateCourse(id, data, adminUserId) {
    await this.getCourseById(id);

    if (data.departmentId) {
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

  async deleteCourse(id, adminUserId) {
    const course = await this.getCourseById(id);

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

  async assignFaculty(courseId, facultyId, isCoordinator, adminUserId) {
    await this.getCourseById(courseId);

    // Verify faculty user
    const facultyUser = await prisma.user.findUnique({
      where: { id: facultyId },
    });

    if (!facultyUser || facultyUser.role !== 'FACULTY') {
      throw ApiError.badRequest(`User with ID ${facultyId} is not a valid faculty member`);
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

  async removeFaculty(courseId, facultyId, adminUserId) {
    await this.getCourseById(courseId);
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
