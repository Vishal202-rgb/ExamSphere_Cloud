// ==============================================================================
// ExamSphere – User Management Service
// ==============================================================================

import bcrypt from 'bcryptjs';
import { parse } from 'csv-parse/sync';
import { userRepository } from './users.repository.js';
import { departmentRepository } from '../departments/departments.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { prisma } from '../../config/db.js';
import { env } from '../../config/env.js';

export class UserService {
  async getUsers(params) {
    return userRepository.findAll(params);
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound(`User with ID ${id} not found`);
    }
    const { password, refreshToken, resetPasswordToken, resetPasswordExpiry, ...sanitized } = user;
    return sanitized;
  }

  async createFaculty(data, adminUserId) {
    const existing = await userRepository.findByEmail(data.email);
    if (existing) {
      throw ApiError.conflict(`Email '${data.email}' is already registered`);
    }

    if (data.departmentId) {
      const dept = await departmentRepository.findById(data.departmentId);
      if (!dept) {
        throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
      }
    }

    const hashedPassword = await bcrypt.hash(data.password || 'Faculty@12345', env.BCRYPT_SALT_ROUNDS || 12);

    const faculty = await userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: 'FACULTY',
      departmentId: data.departmentId || null,
      isActive: true,
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'FACULTY_CREATED',
        resource: 'USER',
        resourceId: faculty.id,
        metadata: { email: faculty.email, name: faculty.name },
      },
    }).catch(() => {});

    return faculty;
  }

  async createStudent(data, adminUserId) {
    const [existingEmail, existingRoll] = await Promise.all([
      userRepository.findByEmail(data.email),
      userRepository.findByRollNumber(data.rollNumber),
    ]);

    if (existingEmail) {
      throw ApiError.conflict(`Email '${data.email}' is already registered`);
    }

    if (existingRoll) {
      throw ApiError.conflict(`Roll number '${data.rollNumber}' is already registered`);
    }

    if (data.departmentId) {
      const dept = await departmentRepository.findById(data.departmentId);
      if (!dept) {
        throw ApiError.badRequest(`Department with ID ${data.departmentId} does not exist`);
      }
    }

    const hashedPassword = await bcrypt.hash(data.password || 'Student@12345', env.BCRYPT_SALT_ROUNDS || 12);

    const student = await userRepository.create({
      name: data.name,
      email: data.email,
      password: hashedPassword,
      role: 'STUDENT',
      departmentId: data.departmentId || null,
      rollNumber: data.rollNumber,
      batch: data.batch,
      section: data.section,
      isActive: true,
    });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'STUDENT_CREATED',
        resource: 'USER',
        resourceId: student.id,
        metadata: { rollNumber: student.rollNumber, email: student.email },
      },
    }).catch(() => {});

    return student;
  }

  async updateUser(id, data, adminUserId) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw ApiError.notFound('User not found');
    }

    if (data.email && data.email !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && existing.id !== id) {
        throw ApiError.conflict(`Email '${data.email}' is already in use`);
      }
    }

    if (data.rollNumber && data.rollNumber !== user.rollNumber) {
      const existing = await userRepository.findByRollNumber(data.rollNumber);
      if (existing && existing.id !== id) {
        throw ApiError.conflict(`Roll number '${data.rollNumber}' is already in use`);
      }
    }

    const updated = await userRepository.update(id, data);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'USER_UPDATED',
        resource: 'USER',
        resourceId: id,
        metadata: data,
      },
    }).catch(() => {});

    return updated;
  }

  async toggleAccountStatus(id, isActive, adminUserId) {
    await this.getUserById(id);
    const updated = await userRepository.update(id, { isActive });

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: isActive ? 'ACCOUNT_ACTIVATED' : 'ACCOUNT_DEACTIVATED',
        resource: 'USER',
        resourceId: id,
      },
    }).catch(() => {});

    return updated;
  }

  /**
   * Bulk import students via CSV text/buffer with atomic rollback on critical error
   */
  async bulkImportStudents(csvContent, departmentId, adminUserId) {
    if (!csvContent) {
      throw ApiError.badRequest('No CSV file content provided');
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

    // Required headers: name, email, rollNumber, batch, section
    const errors = [];
    const validStudents = [];
    const seenEmails = new Set();
    const seenRolls = new Set();
    const defaultPasswordHash = await bcrypt.hash('Student@12345', env.BCRYPT_SALT_ROUNDS || 12);

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNum = i + 2; // 1-indexed accounting for header row

      const name = row.name || row.Name;
      const email = (row.email || row.Email || '').toLowerCase().trim();
      const rollNumber = (row.rollNumber || row.roll_number || row.RollNumber || '').trim();
      const batch = (row.batch || row.Batch || '').trim();
      const section = (row.section || row.Section || '').trim();

      if (!name || !email || !rollNumber) {
        errors.push(`Row ${rowNum}: Name, email, and rollNumber are required fields`);
        continue;
      }

      // Check within-file duplicates
      if (seenEmails.has(email)) {
        errors.push(`Row ${rowNum}: Duplicate email '${email}' detected inside CSV file`);
        continue;
      }
      if (seenRolls.has(rollNumber)) {
        errors.push(`Row ${rowNum}: Duplicate roll number '${rollNumber}' detected inside CSV file`);
        continue;
      }

      // Check database duplicates
      const [emailExists, rollExists] = await Promise.all([
        userRepository.findByEmail(email),
        userRepository.findByRollNumber(rollNumber),
      ]);

      if (emailExists) {
        errors.push(`Row ${rowNum}: Email '${email}' already exists in database`);
        continue;
      }
      if (rollExists) {
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
        departmentId: departmentId || null,
        rollNumber,
        batch: batch || '2023-2027',
        section: section || 'A',
        isActive: true,
      });
    }

    if (validStudents.length === 0) {
      throw ApiError.badRequest('No valid student records could be parsed from the CSV file', errors);
    }

    // Execute atomic batch insertion
    const createdStudents = await userRepository.bulkCreateStudents(validStudents);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'STUDENTS_BULK_IMPORTED',
        resource: 'USER',
        metadata: {
          importedCount: createdStudents.length,
          skippedCount: errors.length,
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

  /**
   * Export students to CSV format
   */
  async exportStudentsCSV(filters) {
    const students = await userRepository.exportStudents(filters);

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
