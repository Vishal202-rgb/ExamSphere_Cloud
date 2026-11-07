// ==============================================================================
// ExamSphere – Department Service
// ==============================================================================

import { departmentRepository } from './departments.repository.js';
import { ApiError } from '../../utils/apiError.js';
import { prisma } from '../../config/db.js';

export class DepartmentService {
  async getDepartments(params) {
    return departmentRepository.findAll(params);
  }

  async getDepartmentById(id) {
    const dept = await departmentRepository.findById(id);
    if (!dept) {
      throw ApiError.notFound(`Department with ID ${id} not found`);
    }
    return dept;
  }

  async createDepartment(data, adminUserId) {
    const [existingCode, existingName] = await Promise.all([
      departmentRepository.findByCode(data.code),
      departmentRepository.findByName(data.name),
    ]);

    if (existingCode) {
      throw ApiError.conflict(`Department code '${data.code}' is already registered`);
    }

    if (existingName) {
      throw ApiError.conflict(`Department name '${data.name}' is already in use`);
    }

    const department = await departmentRepository.create(data);

    // Audit log
    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DEPARTMENT_CREATED',
        resource: 'DEPARTMENT',
        resourceId: department.id,
        metadata: { code: department.code, name: department.name },
      },
    }).catch(() => {});

    return department;
  }

  async updateDepartment(id, data, adminUserId) {
    await this.getDepartmentById(id);

    if (data.code) {
      const existingCode = await departmentRepository.findByCode(data.code);
      if (existingCode && existingCode.id !== id) {
        throw ApiError.conflict(`Department code '${data.code}' is already in use`);
      }
    }

    if (data.name) {
      const existingName = await departmentRepository.findByName(data.name);
      if (existingName && existingName.id !== id) {
        throw ApiError.conflict(`Department name '${data.name}' is already in use`);
      }
    }

    const updated = await departmentRepository.update(id, data);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DEPARTMENT_UPDATED',
        resource: 'DEPARTMENT',
        resourceId: id,
        metadata: data,
      },
    }).catch(() => {});

    return updated;
  }

  async deleteDepartment(id, adminUserId) {
    const dept = await this.getDepartmentById(id);

    if (dept._count?.courses > 0 || dept._count?.users > 0) {
      // Soft-deactivate if dependencies exist
      return departmentRepository.update(id, { isActive: false });
    }

    await departmentRepository.delete(id);

    await prisma.auditLog.create({
      data: {
        userId: adminUserId,
        action: 'DEPARTMENT_DELETED',
        resource: 'DEPARTMENT',
        resourceId: id,
      },
    }).catch(() => {});

    return { message: 'Department successfully removed' };
  }
}

export const departmentService = new DepartmentService();
