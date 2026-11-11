// ==============================================================================
// ExamSphere – User Management Controller
// ==============================================================================

import { userService } from './users.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getUsers = asyncHandler(async (req, res) => {
  const {
    role,
    departmentId,
    batch,
    section,
    isActive,
    search,
    page = 1,
    limit = 10,
  } = req.query;

  const result = await userService.getUsers(
    {
      role,
      departmentId,
      batch,
      section,
      search,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
    },
    req.user
  );

  return res.status(200).json(ApiResponse.success(result, 'Users list retrieved'));
});

export const getUserById = asyncHandler(async (req, res) => {
  const user = await userService.getUserById(req.params.id, req.user);
  return res.status(200).json(ApiResponse.success(user, 'User details retrieved'));
});

export const createDepartmentAdmin = asyncHandler(async (req, res) => {
  const admin = await userService.createDepartmentAdmin(
    req.body,
    req.user,
    req.ip,
    req.headers['user-agent']
  );
  return res
    .status(201)
    .json(ApiResponse.created(admin, 'Department Administrator account provisioned successfully'));
});

export const createFaculty = asyncHandler(async (req, res) => {
  const faculty = await userService.createFaculty(
    req.body,
    req.user,
    req.ip,
    req.headers['user-agent']
  );
  return res.status(201).json(ApiResponse.created(faculty, 'Faculty account created successfully'));
});

export const createStudent = asyncHandler(async (req, res) => {
  const student = await userService.createStudent(
    req.body,
    req.user,
    req.ip,
    req.headers['user-agent']
  );
  return res.status(201).json(ApiResponse.created(student, 'Student account created successfully'));
});

export const updateUser = asyncHandler(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  return res.status(200).json(ApiResponse.success(user, 'User updated successfully'));
});

export const toggleAccountStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const user = await userService.toggleAccountStatus(req.params.id, isActive, req.user);
  return res
    .status(200)
    .json(
      ApiResponse.success(
        user,
        `Account ${isActive ? 'activated' : 'deactivated'} successfully`
      )
    );
});

export const bulkImportStudents = asyncHandler(async (req, res) => {
  let csvContent = '';

  if (req.file) {
    csvContent = req.file.buffer.toString('utf-8');
  } else if (req.body?.csvData) {
    csvContent = req.body.csvData;
  }

  const { departmentId } = req.body;
  const result = await userService.bulkImportStudents(csvContent, departmentId, req.user);

  return res
    .status(200)
    .json(ApiResponse.success(result, `Successfully imported ${result.importedCount} students`));
});

export const exportStudents = asyncHandler(async (req, res) => {
  const { departmentId, batch, section } = req.query;
  const csv = await userService.exportStudentsCSV({ departmentId, batch, section }, req.user);

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="examsphere_students.csv"');
  return res.status(200).send(csv);
});
