// ==============================================================================
// ExamSphere – Department Controller
// ==============================================================================

import { departmentService } from './departments.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getDepartments = asyncHandler(async (req, res) => {
  const { search, page = 1, limit = 10, isActive } = req.query;
  const result = await departmentService.getDepartments({
    search,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  return res.status(200).json(ApiResponse.success(result, 'Departments retrieved successfully'));
});

export const getDepartmentById = asyncHandler(async (req, res) => {
  const department = await departmentService.getDepartmentById(req.params.id);
  return res.status(200).json(ApiResponse.success(department, 'Department details retrieved'));
});

export const createDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.createDepartment(req.body, req.user.id);
  return res.status(201).json(ApiResponse.created(department, 'Department created successfully'));
});

export const updateDepartment = asyncHandler(async (req, res) => {
  const department = await departmentService.updateDepartment(req.params.id, req.body, req.user.id);
  return res.status(200).json(ApiResponse.success(department, 'Department updated successfully'));
});

export const deleteDepartment = asyncHandler(async (req, res) => {
  const result = await departmentService.deleteDepartment(req.params.id, req.user.id);
  return res.status(200).json(ApiResponse.success(result, 'Department deleted successfully'));
});
