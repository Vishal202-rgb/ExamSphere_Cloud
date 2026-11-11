// ==============================================================================
// ExamSphere – User Management Service
// Direct admin onboarding with secure activation, department scoping & audit trails
// ==============================================================================

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { userRepository } from './users.repository.js';
import { departmentRepository } from '../departments/departments.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';
import { emailService } from '../../utils/email.service.js';

export class UserService {
  async getUsers(params, requestingUser) {
    const queryParams = { ...params };

    // Enforce department scoping for Department Admins
    if (requestingUser && requestingUser.role === 'DEPARTMENT_ADMIN') {
      queryParams.departmentId = requestingUser.departmentId;
    }

    return userRepository.findAll(queryParams);
  }

  async getUserById(id, requestingUser) {
    const user = await userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw ApiError.notFound(`User with ID ${id} not found`);
    }

    // Department Admin scoping
    if (
      requestingUser &&
      requestingUser.role === 'DEPARTMENT_ADMIN' &&
      user.departmentId !== requestingUser.departmentId
    ) {
      throw ApiError.forbidden('Forbidden: User belongs to a different department');
    }

    const { password, refreshToken, resetPasswordToken, resetPasswordExpiry, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Super Admin creates a Department Admin
   */
  async createDepartmentAdmin(data, adminUser, ipAddress, userAgent) {
    if (adminUser.role !== 'SUPER_ADMIN') {
      throw ApiError.forbidden('Only Super Administrators can create Department Administrators');
    }

    const dept = await departmentRepository.findById(data.departmentId);
    if (!dept) {
      throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
    }

    const [existingEmail, existingEmp] = await Promise.all([
      userRepository.findByEmail(data.email),
      data.employeeId ? userRepository.findByEmployeeId(data.employeeId) : null,
    ]);

    if (existingEmail && !existingEmail.deletedAt) {
      throw ApiError.conflict(`Email '${data.email}' is already registered`);
    }
    if (existingEmp && !existingEmp.deletedAt) {
      throw ApiError.conflict(`Employee ID '${data.employeeId}' is already registered`);
    }

    // Single-use password activation token if password not provided
    let passwordHash = null;
    let activationToken = null;
    let resetPasswordExpiry = null;
    let tokenHash = null;

    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS || 12);
    } else {
      activationToken = crypto.randomBytes(32).toString('hex');
      tokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
      resetPasswordExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h activation window
      // Dummy strong hashed placeholder until activation
      passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), env.BCRYPT_SALT_ROUNDS || 12);
    }

    const departmentAdmin = await userRepository.create({
      name: data.name || data.fullName,
      email: data.email,
      password: passwordHash,
      role: 'DEPARTMENT_ADMIN',
      departmentId: data.departmentId,
      employeeId: data.employeeId || null,
      designation: data.designation || 'Department Administrator',
      isActive: true,
      isDemo: false,
      isEmailVerified: Boolean(data.password),
      resetPasswordToken: tokenHash,
      resetPasswordExpiry,
    });

    if (activationToken) {
      const activationUrl = `${env.CLIENT_URL}/reset-password?token=${activationToken}`;
      await emailService.sendActivationEmail({
        to: data.email,
        name: data.name,
        role: 'DEPARTMENT_ADMIN',
        activationUrl,
        expiresAt: resetPasswordExpiry,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'DEPARTMENT_ADMIN_CREATED',
        resource: 'USER',
        resourceId: departmentAdmin.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          email: departmentAdmin.email,
          name: departmentAdmin.name,
          departmentId: data.departmentId,
        },
      },
    }).catch(() => {});

    return {
      ...departmentAdmin,
      ...(activationToken && env.NODE_ENV !== 'production' && {
        activationUrl: `${env.CLIENT_URL}/reset-password?token=${activationToken}`,
      }),
    };
  }

  /**
   * Provision Faculty account with assigned courses
   */
  async createFaculty(data, adminUser, ipAddress, userAgent) {
    // Department scoping
    if (adminUser.role === 'DEPARTMENT_ADMIN') {
      if (data.departmentId && data.departmentId !== adminUser.departmentId) {
        throw ApiError.forbidden('Forbidden: You can only create faculty within your assigned department');
      }
      data.departmentId = adminUser.departmentId;
    }

    if (!data.departmentId) {
      throw ApiError.badRequest('A departmentId is required to provision faculty');
    }

    const dept = await departmentRepository.findById(data.departmentId);
    if (!dept) {
      throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
    }

    const [existingEmail, existingEmp] = await Promise.all([
      userRepository.findByEmail(data.email),
      data.employeeId ? userRepository.findByEmployeeId(data.employeeId) : null,
    ]);

    if (existingEmail && !existingEmail.deletedAt) {
      throw ApiError.conflict(`Email '${data.email}' is already registered`);
    }
    if (existingEmp && !existingEmp.deletedAt) {
      throw ApiError.conflict(`Employee ID '${data.employeeId}' is already registered`);
    }

    // Verify assigned courses belong to the department
    if (data.assignedCourses && data.assignedCourses.length > 0) {
      const courses = await prisma.course.findMany({
        where: {
          id: { in: data.assignedCourses },
          departmentId: data.departmentId,
        },
      });
      if (courses.length !== data.assignedCourses.length) {
        throw ApiError.badRequest('One or more assigned courses do not belong to the selected department');
      }
    }

    let passwordHash = null;
    let activationToken = null;
    let resetPasswordExpiry = null;
    let tokenHash = null;

    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS || 12);
    } else {
      activationToken = crypto.randomBytes(32).toString('hex');
      tokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
      resetPasswordExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), env.BCRYPT_SALT_ROUNDS || 12);
    }

    const faculty = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name || data.fullName,
          email: data.email,
          password: passwordHash,
          role: 'FACULTY',
          departmentId: data.departmentId,
          employeeId: data.employeeId || null,
          designation: data.designation || 'Faculty Member',
          isActive: true,
          isDemo: false,
          isEmailVerified: Boolean(data.password),
          resetPasswordToken: tokenHash,
          resetPasswordExpiry,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          employeeId: true,
          designation: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (data.assignedCourses && data.assignedCourses.length > 0) {
        for (const courseId of data.assignedCourses) {
          await tx.courseFaculty.create({
            data: {
              courseId,
              facultyId: user.id,
              isCoordinator: false,
            },
          });
        }
      }

      return user;
    });

    if (activationToken) {
      const activationUrl = `${env.CLIENT_URL}/reset-password?token=${activationToken}`;
      await emailService.sendActivationEmail({
        to: data.email,
        name: data.name,
        role: 'FACULTY',
        activationUrl,
        expiresAt: resetPasswordExpiry,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'FACULTY_CREATED',
        resource: 'USER',
        resourceId: faculty.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          email: faculty.email,
          name: faculty.name,
          assignedCoursesCount: data.assignedCourses?.length || 0,
        },
      },
    }).catch(() => {});

    return {
      ...faculty,
      ...(activationToken && env.NODE_ENV !== 'production' && {
        activationUrl: `${env.CLIENT_URL}/reset-password?token=${activationToken}`,
      }),
    };
  }

  /**
   * Provision Student account with enrolled courses
   */
  async createStudent(data, adminUser, ipAddress, userAgent) {
    if (adminUser.role === 'DEPARTMENT_ADMIN') {
      if (data.departmentId && data.departmentId !== adminUser.departmentId) {
        throw ApiError.forbidden('Forbidden: You can only create students within your assigned department');
      }
      data.departmentId = adminUser.departmentId;
    }

    if (!data.departmentId) {
      throw ApiError.badRequest('A departmentId is required to register a student');
    }

    const dept = await departmentRepository.findById(data.departmentId);
    if (!dept) {
      throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
    }

    const [existingEmail, existingRoll] = await Promise.all([
      userRepository.findByEmail(data.email),
      userRepository.findByRollNumber(data.rollNumber),
    ]);

    if (existingEmail && !existingEmail.deletedAt) {
      throw ApiError.conflict(`Email '${data.email}' is already registered`);
    }

    if (existingRoll && !existingRoll.deletedAt) {
      throw ApiError.conflict(`Roll number '${data.rollNumber}' is already registered`);
    }

    if (data.enrolledCourses && data.enrolledCourses.length > 0) {
      const courses = await prisma.course.findMany({
        where: {
          id: { in: data.enrolledCourses },
          departmentId: data.departmentId,
        },
      });
      if (courses.length !== data.enrolledCourses.length) {
        throw ApiError.badRequest('One or more enrolled courses do not belong to the student department');
      }
    }

    let passwordHash = null;
    let activationToken = null;
    let resetPasswordExpiry = null;
    let tokenHash = null;

    if (data.password) {
      passwordHash = await bcrypt.hash(data.password, env.BCRYPT_SALT_ROUNDS || 12);
    } else {
      activationToken = crypto.randomBytes(32).toString('hex');
      tokenHash = crypto.createHash('sha256').update(activationToken).digest('hex');
      resetPasswordExpiry = new Date(Date.now() + 48 * 60 * 60 * 1000);
      passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), env.BCRYPT_SALT_ROUNDS || 12);
    }

    const student = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name || data.fullName,
          email: data.email,
          password: passwordHash,
          role: 'STUDENT',
          departmentId: data.departmentId,
          rollNumber: data.rollNumber,
          batch: data.batch,
          section: data.section,
          isActive: true,
          isDemo: false,
          isEmailVerified: Boolean(data.password),
          resetPasswordToken: tokenHash,
          resetPasswordExpiry,
        },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
          departmentId: true,
          rollNumber: true,
          batch: true,
          section: true,
          isActive: true,
          createdAt: true,
        },
      });

      if (data.enrolledCourses && data.enrolledCourses.length > 0) {
        for (const courseId of data.enrolledCourses) {
          await tx.studentEnrollment.create({
            data: {
              courseId,
              studentId: user.id,
              status: 'ACTIVE',
            },
          });
        }
      }

      return user;
    });

    if (activationToken) {
      const activationUrl = `${env.CLIENT_URL}/reset-password?token=${activationToken}`;
      await emailService.sendActivationEmail({
        to: data.email,
        name: data.name,
        role: 'STUDENT',
        activationUrl,
        expiresAt: resetPasswordExpiry,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'STUDENT_CREATED',
        resource: 'USER',
        resourceId: student.id,
        ipAddress: ipAddress || null,
        userAgent: userAgent || null,
        metadata: {
          rollNumber: student.rollNumber,
          email: student.email,
          enrolledCoursesCount: data.enrolledCourses?.length || 0,
        },
      },
    }).catch(() => {});

    return {
      ...student,
      ...(activationToken && env.NODE_ENV !== 'production' && {
        activationUrl: `${env.CLIENT_URL}/reset-password?token=${activationToken}`,
      }),
    };
  }

  async updateUser(id, data, adminUser) {
    const user = await userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw ApiError.notFound('User not found');
    }

    // Department scoping
    if (
      adminUser.role === 'DEPARTMENT_ADMIN' &&
      user.departmentId !== adminUser.departmentId
    ) {
      throw ApiError.forbidden('Forbidden: Cannot modify users in another department');
    }

    // Role escalation & modification protection
    if (data.role && data.role !== user.role) {
      if (data.role === 'SUPER_ADMIN') {
        throw ApiError.forbidden(
          'Role escalation to Super Admin must use the verified Super Admin promotion workflow'
        );
      }
      if (user.role === 'SUPER_ADMIN') {
        throw ApiError.forbidden(
          'Super Admin role modifications must use the verified Super Admin governance workflow'
        );
      }
      if (adminUser.role === 'DEPARTMENT_ADMIN' && data.role === 'DEPARTMENT_ADMIN') {
        throw ApiError.forbidden('Department Administrators cannot create or promote other Department Administrators');
      }
    }

    if (data.email && data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && existing.id !== id && !existing.deletedAt) {
        throw ApiError.conflict(`Email '${data.email}' is already in use`);
      }
    }

    if (data.rollNumber && data.rollNumber !== user.rollNumber) {
      const existing = await userRepository.findByRollNumber(data.rollNumber);
      if (existing && existing.id !== id && !existing.deletedAt) {
        throw ApiError.conflict(`Roll number '${data.rollNumber}' is already in use`);
      }
    }

    if (data.employeeId && data.employeeId !== user.employeeId) {
      const existing = await userRepository.findByEmployeeId(data.employeeId);
      if (existing && existing.id !== id && !existing.deletedAt) {
        throw ApiError.conflict(`Employee ID '${data.employeeId}' is already in use`);
      }
    }

    const updated = await userRepository.update(id, data);

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: data.role && data.role !== user.role ? 'ROLE_CHANGED' : 'USER_UPDATED',
        resource: 'USER',
        resourceId: id,
        metadata: {
          ...data,
          previousRole: user.role,
        },
      },
    }).catch(() => {});

    return updated;
  }

  async toggleAccountStatus(id, isActive, adminUser) {
    const user = await this.getUserById(id, adminUser);

    // Prevent deactivation of the last active Super Admin
    if (!isActive && user.role === 'SUPER_ADMIN') {
      const activeSuperAdminCount = await prisma.user.count({
        where: {
          role: 'SUPER_ADMIN',
          isActive: true,
          deletedAt: null,
        },
      });

      if (activeSuperAdminCount <= 1) {
        throw ApiError.forbidden(
          'Cannot deactivate the last active Super Admin. At least one active Super Admin must remain to maintain platform access.'
        );
      }
    }

    const updated = await userRepository.update(id, { isActive });

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
        resource: 'USER',
        resourceId: id,
        metadata: { role: user.role, email: user.email },
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Bulk import students via CSV text/buffer with atomic rollback on critical error
   */
  async bulkImportStudents(csvContent, departmentId, adminUser) {
    if (!csvContent) {
      throw ApiError.badRequest('No CSV file content provided');
    }

    if (adminUser.role === 'DEPARTMENT_ADMIN') {
      departmentId = adminUser.departmentId;
    }

    if (!departmentId) {
      throw ApiError.badRequest('A departmentId is required for student bulk import');
    }

    let records;
    try {
      records = parse(csvContent, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (err) {
      throw ApiError.badRequest(`Failed to parse CSV format: ${err.message}`);
    }

    if (!records || records.length === 0) {
      throw ApiError.badRequest('CSV file is empty or missing valid header rows');
    }

    const errors = [];
    const validStudents = [];
    const seenEmails = new Set();
    const seenRolls = new Set();
    const defaultPasswordHash = await bcrypt.hash('Student@12345', env.BCRYPT_SALT_ROUNDS || 12);

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2;

      const name = row.name || row.Name;
      const email = (row.email || row.Email || '').toLowerCase().trim();
      const rollNumber = (row.rollNumber || row.roll_number || row.RollNumber || '').trim();
      const batch = (row.batch || row.Batch || '').trim();
      const section = (row.section || row.Section || '').trim();

      if (!name || !email || !rollNumber) {
        errors.push(`Row ${rowNum}: Name, email, and rollNumber are required fields`);
        continue;
      }

      if (seenEmails.has(email)) {
        errors.push(`Row ${rowNum}: Duplicate email '${email}' detected inside CSV file`);
        continue;
      }
      if (seenRolls.has(rollNumber)) {
        errors.push(`Row ${rowNum}: Duplicate roll number '${rollNumber}' detected inside CSV file`);
        continue;
      }

      const [emailExists, rollExists] = await Promise.all([
        userRepository.findByEmail(email),
        userRepository.findByRollNumber(rollNumber),
      ]);

      if (emailExists && !emailExists.deletedAt) {
        errors.push(`Row ${rowNum}: Email '${email}' already exists in database`);
        continue;
      }
      if (rollExists && !rollExists.deletedAt) {
        errors.push(`Row ${rowNum}: Roll number '${rollNumber}' already exists in database`);
        continue;
      }

      seenEmails.add(email);
      seenRolls.add(rollNumber);

      validStudents.push({
        name,
        email,
        password: defaultPasswordHash,
        role: 'STUDENT',
        departmentId,
        rollNumber,
        batch: batch || '2023-2027',
        section: section || 'A',
        isActive: true,
        isDemo: false,
        isEmailVerified: true,
      });
    }

    if (validStudents.length === 0) {
      throw ApiError.badRequest('No valid student records could be parsed from the CSV file', errors);
    }

    const createdStudents = await userRepository.bulkCreateStudents(validStudents);

    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'STUDENTS_BULK_IMPORTED',
        resource: 'USER',
        metadata: {
          importedCount: createdStudents.length,
          skippedCount: errors.length,
          departmentId,
        },
      },
    }).catch(() => {});

    return {
      importedCount: createdStudents.length,
      skippedCount: errors.length,
      errors,
      students: createdStudents,
    };
  }

  async exportStudentsCSV(filters, requestingUser) {
    const activeFilters = { ...filters };
    if (requestingUser.role === 'DEPARTMENT_ADMIN') {
      activeFilters.departmentId = requestingUser.departmentId;
    }

    const students = await userRepository.exportStudents(activeFilters);

    const headers = 'Roll Number,Full Name,Email,Department,Batch,Section,Status,Created At\n';
    const rows = students
      .map((s) => {
        const deptCode = s.department?.code || 'N/A';
        const status = s.isActive ? 'Active' : 'Inactive';
        const date = new Date(s.createdAt).toISOString().split('T')[0];
        return `"${s.rollNumber}","${s.name}","${s.email}","${deptCode}","${s.batch || ''}","${s.section || ''}","${status}","${date}"`;
      })
      .join('\n');

    return headers + rows;
  }
}

export const userService = new UserService();
