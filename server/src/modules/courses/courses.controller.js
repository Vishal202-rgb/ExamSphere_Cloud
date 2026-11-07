// ==============================================================================
// ExamSphere – Course Controller
// ==============================================================================

import { courseService } from './courses.service.js';
import { ApiResponse } from '../../utils/apiResponse.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getCourses = asyncHandler(async (req, res) => {
  const { search, departmentId, page = 1, limit = 10, isActive } = req.query;
  const result = await courseService.getCourses({
    search,
    departmentId,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    isActive: isActive !== undefined ? isActive === 'true' : undefined,
  });
  return res.status(200).json(ApiResponse.success(result, 'Courses retrieved successfully'));
});

export const getCourseById = asyncHandler(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id);
  return res.status(200).json(ApiResponse.success(course, 'Course details retrieved'));
});

export const createCourse = asyncHandler(async (req, res) => {
  const course = await courseService.createCourse(req.body, req.user.id);
  return res.status(201).json(ApiResponse.created(course, 'Course created successfully'));
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await courseService.updateCourse(req.params.id, req.body, req.user.id);
  return res.status(200).json(ApiResponse.success(course, 'Course updated successfully'));
});

export const deleteCourse = asyncHandler(async (req, res) => {
  const result = await courseService.deleteCourse(req.params.id, req.user.id);
  return res.status(200).json(ApiResponse.success(result, 'Course deleted successfully'));
});

export const assignFaculty = asyncHandler(async (req, res) => {
  const { facultyId, isCoordinator } = req.body;
  const assignment = await courseService.assignFaculty(
    req.params.id,
    facultyId,
    isCoordinator,
    req.user.id
  );
  return res.status(200).json(ApiResponse.success(assignment, 'Faculty assigned to course'));
});

export const removeFaculty = asyncHandler(async (req, res) => {
  const result = await courseService.removeFaculty(
    req.params.id,
    req.params.facultyId,
    req.user.id
  );
  return res.status(200).json(ApiResponse.success(result, 'Faculty unassigned successfully'));
});
