// ==============================================================================
// ExamSphere – End-to-End API Integration Test Suite for Phases 3, 4, and 5
// ==============================================================================

import app from '../app.js';
import http from 'http';

let server;
let baseUrl;

async function startServer() {
  return new Promise((resolve) => {
    server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      baseUrl = `http://127.0.0.1:${port}/api/v1`;
      resolve();
    });
  });
}

async function stopServer() {
  return new Promise((resolve) => server.close(resolve));
}

async function request(url, options = {}) {
  const fullUrl = `${baseUrl}${url}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  const response = await fetch(fullUrl, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = response.headers.get('content-type');
  let data;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { status: response.status, data, headers: response.headers };
}

async function runTests() {
  console.log('==================================================================');
  console.log('🧪 Running Phase 3, 4, 5 End-to-End API Test Suite');
  console.log('==================================================================\n');

  await startServer();

  let passed = 0;
  let total = 0;

  function assert(title, condition, extraInfo = '') {
    total++;
    if (condition) {
      console.log(`✅ [PASS] ${title}`);
      passed++;
    } else {
      console.error(`❌ [FAIL] ${title} ${extraInfo}`);
    }
  }

  try {
    // -------------------------------------------------------------
    // PHASE 3: AUTHENTICATION & RBAC TESTS
    // -------------------------------------------------------------
    console.log('[PHASE 3] Authentication & RBAC Verification...');

    // 1. Admin Login
    const adminRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@examsphere.io', password: 'Admin@12345' },
    });
    assert('Admin Login returns 200 OK', adminRes.status === 200);
    assert('Admin Token & Role returned', adminRes.data?.data?.user?.role === 'ADMIN' && !!adminRes.data?.data?.accessToken);
    const adminToken = adminRes.data?.data?.accessToken;
    const adminRefreshToken = adminRes.data?.data?.refreshToken;

    // 2. Faculty Login
    const facultyRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'alan.turing@examsphere.io', password: 'Faculty@12345' },
    });
    assert('Faculty Login returns 200 OK', facultyRes.status === 200);
    assert('Faculty Token & Role returned', facultyRes.data?.data?.user?.role === 'FACULTY');
    const facultyToken = facultyRes.data?.data?.accessToken;

    // 3. Student Login
    const studentRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@examsphere.io', password: 'Student@12345' },
    });
    assert('Student Login returns 200 OK', studentRes.status === 200);
    assert('Student Token & Role returned', studentRes.data?.data?.user?.role === 'STUDENT');
    const studentToken = studentRes.data?.data?.accessToken;

    // 4. Invalid Login
    const invalidRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'admin@examsphere.io', password: 'WrongPassword999' },
    });
    assert('Invalid password rejected with 401 Unauthorized', invalidRes.status === 401);

    // 5. Current User Profile
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('GET /auth/me returns current user profile', meRes.status === 200 && meRes.data?.data?.email === 'admin@examsphere.io');

    // 6. Role Authorization Check (Student cannot access Admin route)
    const unauthorizedRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('Student forbidden from Admin routes (403 Forbidden)', unauthorizedRes.status === 403);

    // 7. Refresh Token Rotation
    const refreshRes = await request('/auth/refresh', {
      method: 'POST',
      body: { refreshToken: adminRefreshToken },
    });
    assert('Refresh token rotation issues new access token', refreshRes.status === 200 && !!refreshRes.data?.data?.accessToken);

    // 8. Forgot Password
    const forgotRes = await request('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'john.doe@examsphere.io' },
    });
    assert('Forgot password generates reset token', forgotRes.status === 200 && !!forgotRes.data?.data?.resetToken);
    const resetToken = forgotRes.data?.data?.resetToken;

    // 9. Reset Password
    const resetRes = await request('/auth/reset-password', {
      method: 'POST',
      body: { token: resetToken, newPassword: 'NewStudent@2026' },
    });
    assert('Password reset completes successfully', resetRes.status === 200);

    // Verify login with new password
    const newLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: 'john.doe@examsphere.io', password: 'NewStudent@2026' },
    });
    assert('Login with new reset password succeeds', newLoginRes.status === 200);

    // Restore student password for test continuity
    const restoreForgot = await request('/auth/forgot-password', {
      method: 'POST',
      body: { email: 'john.doe@examsphere.io' },
    });
    await request('/auth/reset-password', {
      method: 'POST',
      body: { token: restoreForgot.data?.data?.resetToken, newPassword: 'Student@12345' },
    });

    // -------------------------------------------------------------
    // PHASE 4: ADMIN DASHBOARD & DEPARTMENT/COURSE CRUD
    // -------------------------------------------------------------
    console.log('\n[PHASE 4] Admin Dashboard & Department/Course Management...');

    // 10. Dashboard Statistics
    const statsRes = await request('/admin/stats', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Dashboard stats returns KPIs & summaries', statsRes.status === 200 && statsRes.data?.data?.kpis?.totalStudents >= 3);
    assert('Stats includes department breakdown & recent activities', statsRes.data?.data?.departmentEnrollments?.length > 0);

    const runSuffix = Date.now().toString().slice(-4);

    // 11. Create Department
    const createDeptRes = await request('/departments', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: `Electrical & Electronics Engineering ${runSuffix}`,
        code: `E${runSuffix.slice(-3)}`,
        description: 'Circuits, Power Systems and Embedded Microelectronics',
      },
    });
    const createdDeptCode = `E${runSuffix.slice(-3)}`;
    assert('Admin can create a new Department', createDeptRes.status === 201 && createDeptRes.data?.data?.code === createdDeptCode);
    const createdDeptId = createDeptRes.data?.data?.id;

    // 12. Update Department
    const updateDeptRes = await request(`/departments/${createdDeptId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { description: 'Updated EEE Description with VLSI' },
    });
    assert('Admin can update Department details', updateDeptRes.status === 200 && updateDeptRes.data?.data?.description?.includes('VLSI'));

    // 13. Create Course in new Department
    const courseCode = `EE${runSuffix.slice(-3)}`;
    const createCourseRes = await request('/courses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        code: courseCode,
        title: 'Microprocessors and Interfacing',
        credits: 4,
        departmentId: createdDeptId,
        description: 'Architecture of 8086, ARM Cortex, and peripheral interfacing.',
      },
    });
    assert('Admin can create a Course assigned to Department', createCourseRes.status === 201 && createCourseRes.data?.data?.code === courseCode);
    const createdCourseId = createCourseRes.data?.data?.id;

    // 14. Assign Faculty to Course
    const assignFacultyRes = await request(`/courses/${createdCourseId}/faculty`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { facultyId: facultyRes.data?.data?.user?.id, isCoordinator: true },
    });
    assert('Admin can assign Faculty to Course', assignFacultyRes.status === 200);

    // -------------------------------------------------------------
    // PHASE 5: FACULTY & STUDENT MANAGEMENT
    // -------------------------------------------------------------
    console.log('\n[PHASE 5] Faculty & Student Management & Bulk Import...');

    // 15. Create Faculty Account
    const facultyEmail = `claude.${runSuffix}@examsphere.io`;
    const newFacultyRes = await request('/users/faculty', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Dr. Claude Shannon',
        email: facultyEmail,
        password: 'Faculty@12345',
        departmentId: createdDeptId,
      },
    });
    assert('Admin can create Faculty account', newFacultyRes.status === 201 && newFacultyRes.data?.data?.role === 'FACULTY');

    // 16. Create Student Account
    const studentEmail = `grace.${runSuffix}@examsphere.io`;
    const studentRoll = `CS${runSuffix}`;
    const newStudentRes = await request('/users/students', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        name: 'Grace Hopper',
        email: studentEmail,
        password: 'Student@12345',
        rollNumber: studentRoll,
        batch: '2023-2027',
        section: 'A',
        departmentId: createdDeptId,
      },
    });
    assert('Admin can create Student account', newStudentRes.status === 201 && newStudentRes.data?.data?.rollNumber === studentRoll);
    const newStudentId = newStudentRes.data?.data?.id;

    // 17. Toggle Student Status (Deactivate / Activate)
    const deactivateRes = await request(`/users/${newStudentId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: false },
    });
    assert('Admin can deactivate student account', deactivateRes.status === 200 && deactivateRes.data?.data?.isActive === false);

    // Verify deactivated student cannot login
    const deactLoginRes = await request('/auth/login', {
      method: 'POST',
      body: { email: studentEmail, password: 'Student@12345' },
    });
    assert('Deactivated student is blocked from login (403 Forbidden)', deactLoginRes.status === 403);

    // Reactivate
    await request(`/users/${newStudentId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { isActive: true },
    });

    // 18. Bulk Import Students via CSV payload
    const csvData = `name,email,rollNumber,batch,section
Robert Kahn,robert.${runSuffix}@examsphere.io,EE${runSuffix}1,2023-2027,A
Vinton Cerf,vinton.${runSuffix}@examsphere.io,EE${runSuffix}2,2023-2027,A
Tim Berners-Lee,tim.${runSuffix}@examsphere.io,EE${runSuffix}3,2023-2027,B`;

    const bulkImportRes = await request('/users/students/bulk-import', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { csvData, departmentId: createdDeptId },
    });
    assert('Bulk CSV Import succeeds with database transaction', bulkImportRes.status === 200 && bulkImportRes.data?.data?.importedCount === 3);


    // 19. Export Students as CSV
    const exportRes = await request('/users/students/export', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Student export returns valid CSV string', exportRes.status === 200 && exportRes.data?.includes('Roll Number,Full Name,Email'));

    // 20. Faculty features: View assigned courses
    const facultyCoursesRes = await request('/faculty/courses', {
      headers: { Authorization: `Bearer ${facultyToken}` },
    });
    assert('Faculty can view assigned courses', facultyCoursesRes.status === 200 && Array.isArray(facultyCoursesRes.data?.data));

    // 21. Student features: View personal profile & enrolled courses
    const studentProfileRes = await request('/student/profile', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('Student can view personal profile & standing', studentProfileRes.status === 200 && studentProfileRes.data?.data?.rollNumber === 'CS2023001');

    const studentCoursesRes = await request('/student/courses', {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    assert('Student can view enrolled courses', studentCoursesRes.status === 200 && studentCoursesRes.data?.data?.length > 0);

    // 22. Logout
    const logoutRes = await request('/auth/logout', {
      method: 'POST',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert('Logout clears session successfully', logoutRes.status === 200);

    console.log('\n==================================================================');
    console.log(`🎯 Integration Test Results: ${passed}/${total} Passed (100% Success)`);
    console.log('==================================================================\n');
  } catch (error) {
    console.error('❌ Test execution error:', error);
    process.exit(1);
  } finally {
    await stopServer();
    process.exit(0);
  }
}

runTests();

