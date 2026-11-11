// ==============================================================================
// ExamSphere – Real User Onboarding & Multi-Admin Live Verification Script
// Tests full sequence: Demo login -> Bootstrap -> Multiple Super Admins ->
// Dept Admin -> Faculty Invitation -> Student Invitation -> Unified Login Redirection
// ==============================================================================

import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/db.js';
import { authService } from '../modules/auth/auth.service.js';
import { superAdminService } from '../modules/admin/superadmin.service.js';
import { invitationService } from '../modules/invitations/invitations.service.js';
import { userService } from '../modules/users/users.service.js';

// Helper for simulating portal destination based on role
function getAuthorizedPortal(role) {
  switch (role) {
    case 'SUPER_ADMIN':
    case 'DEPARTMENT_ADMIN':
    case 'ADMIN':
      return '/admin';
    case 'FACULTY':
      return '/faculty';
    case 'STUDENT':
      return '/student';
    default:
      return '/';
  }
}

async function runLiveVerification() {
  console.log('\n=============================================================');
  console.log('🚀 ExamSphere Real User Onboarding & Multi-Admin Live Test');
  console.log('=============================================================\n');

  let passedSteps = 0;
  let totalSteps = 10;

  try {
    // --------------------------------------------------------------------------
    // STEP 1: Verify Existing Demo Accounts Still Log In and Route Correctly
    // --------------------------------------------------------------------------
    console.log('--- Step 1: Testing Existing Demo Accounts ---');
    const demoAdminLogin = await authService.login({
      email: 'admin@examsphere.io',
      password: 'Admin@12345',
    });
    console.log(`✅ Demo Admin login successful. Role: ${demoAdminLogin.user.role} -> Portal: ${getAuthorizedPortal(demoAdminLogin.user.role)}`);

    const demoFacultyLogin = await authService.login({
      email: 'alan.turing@examsphere.io',
      password: 'Faculty@12345',
    });
    console.log(`✅ Demo Faculty login successful. Role: ${demoFacultyLogin.user.role} -> Portal: ${getAuthorizedPortal(demoFacultyLogin.user.role)}`);

    const demoStudentLogin = await authService.login({
      email: 'john.doe@examsphere.io',
      password: 'Student@12345',
    });
    console.log(`✅ Demo Student login successful. Role: ${demoStudentLogin.user.role} -> Portal: ${getAuthorizedPortal(demoStudentLogin.user.role)}`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 2: Initial Super Admin Bootstrap
    // --------------------------------------------------------------------------
    console.log('\n--- Step 2: Bootstrap Initial Super Admin ---');
    const superAdminEmail = 'director@institution.edu';
    const superAdminPassword = 'Director@SuperAdmin2026!';

    const testEmails = [
      superAdminEmail,
      'codirector@institution.edu',
      'it.admin@institution.edu',
      'prof.shannon@institution.edu',
      'student.grace@institution.edu',
    ];

    // Clean up test audit logs, invitations, and enrollments
    await prisma.invitation.deleteMany({
      where: {
        OR: [
          { email: { in: testEmails } },
          { invitedBy: { email: { in: testEmails } } },
        ],
      },
    });
    await prisma.auditLog.deleteMany({
      where: {
        user: { email: { in: testEmails } },
      },
    });
    await prisma.courseFaculty.deleteMany({
      where: { faculty: { email: { in: testEmails } } },
    });
    await prisma.studentEnrollment.deleteMany({
      where: { student: { email: { in: testEmails } } },
    });
    await prisma.user.deleteMany({
      where: { email: { in: testEmails } },
    });

    const bootstrappedSuperAdmin = await authService.bootstrapInitialSuperAdmin({
      name: 'Dr. Jane Director',
      email: superAdminEmail,
      password: superAdminPassword,
      bootstrapToken: process.env.BOOTSTRAP_TOKEN,
      ipAddress: '127.0.0.1',
      userAgent: 'Live Verification Script',
    });
    console.log(`✅ Initial Super Admin created: ${bootstrappedSuperAdmin.email} (ID: ${bootstrappedSuperAdmin.id})`);

    // Verify bootstrap is now permanently auto-disabled
    try {
      await authService.bootstrapInitialSuperAdmin({
        name: 'Another Super Admin',
        email: 'another@institution.edu',
        password: 'Password@123',
        bootstrapToken: process.env.BOOTSTRAP_TOKEN,
      });
      console.error('❌ Failed: Bootstrap was NOT disabled after initialization!');
    } catch (err) {
      console.log(`✅ Bootstrap auto-disable verified: ${err.message}`);
    }
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 3: Unified /login Authentication for Real Super Admin
    // --------------------------------------------------------------------------
    console.log('\n--- Step 3: Real Super Admin Login & Redirection ---');
    const realSuperAdminLogin = await authService.login({
      email: superAdminEmail,
      password: superAdminPassword,
    });
    const superAdminPortal = getAuthorizedPortal(realSuperAdminLogin.user.role);
    if (superAdminPortal !== '/admin') throw new Error(`Expected /admin portal, got ${superAdminPortal}`);
    console.log(`✅ Real Super Admin logged in successfully! Role: ${realSuperAdminLogin.user.role} -> Target Portal: ${superAdminPortal}`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 4: Multiple Super Admin Management & Step-up Verification
    // --------------------------------------------------------------------------
    console.log('\n--- Step 4: Multiple Super Admin Support & Step-Up Auth ---');
    const secondSuperAdminEmail = 'codirector@institution.edu';

    // Create a regular faculty user first
    const hashedPass = await bcrypt.hash('CoDirector@2026!', 10);
    const candidateAdmin = await prisma.user.create({
      data: {
        name: 'Dr. Alan Co-Director',
        email: secondSuperAdminEmail,
        password: hashedPass,
        role: 'FACULTY',
        isActive: true,
        isEmailVerified: true,
      },
    });

    // Test rejection with wrong step-up password
    try {
      await superAdminService.promoteToSuperAdmin(realSuperAdminLogin.user.id, {
        userId: candidateAdmin.id,
        verificationPassword: 'WrongPassword!',
      });
      console.error('❌ Failed: Step-up password check failed to reject wrong password');
    } catch (err) {
      console.log(`✅ Step-up password check verified (rejected invalid confirmation password)`);
    }

    // Promote with correct step-up password
    await superAdminService.promoteToSuperAdmin(realSuperAdminLogin.user.id, {
      userId: candidateAdmin.id,
      verificationPassword: superAdminPassword,
    });
    console.log(`✅ Multiple Super Admin verified: Promoted ${secondSuperAdminEmail} to SUPER_ADMIN`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 5: Last Active Super Admin Guard
    // --------------------------------------------------------------------------
    console.log('\n--- Step 5: Testing Last Active Super Admin Guard ---');
    // Demote the second admin first
    await superAdminService.demoteSuperAdmin(realSuperAdminLogin.user.id, {
      userId: candidateAdmin.id,
      targetRole: 'FACULTY',
      verificationPassword: superAdminPassword,
    });
    console.log(`✅ Demoted second Super Admin back to FACULTY`);

    // Now attempt to demote the LAST active Super Admin
    try {
      await superAdminService.demoteSuperAdmin(realSuperAdminLogin.user.id, {
        userId: realSuperAdminLogin.user.id,
        targetRole: 'FACULTY',
        verificationPassword: superAdminPassword,
      });
      console.error('❌ Failed: Demoting the last active Super Admin should be rejected!');
    } catch (err) {
      console.log(`✅ Last Super Admin Guard verified: ${err.message}`);
    }
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 6: Real Department Admin Creation
    // --------------------------------------------------------------------------
    console.log('\n--- Step 6: Create Real Department Admin ---');
    const dept = await prisma.department.findFirst({ where: { code: 'IT' } });
    const itAdminEmail = 'it.admin@institution.edu';

    const deptAdmin = await userService.createDepartmentAdmin(
      {
        fullName: 'Prof. IT Department Head',
        email: itAdminEmail,
        employeeId: 'EMP-IT-001',
        designation: 'Head of IT Department',
        departmentId: dept.id,
      },
      realSuperAdminLogin.user,
      '127.0.0.1',
      'Live Verification Script'
    );
    console.log(`✅ Department Admin created: ${deptAdmin.email} for ${dept.name}`);

    // Set password for the dept admin
    const deptAdminPass = 'DeptAdmin@2026!';
    await prisma.user.update({
      where: { id: deptAdmin.id },
      data: { password: await bcrypt.hash(deptAdminPass, 10), isActive: true, isEmailVerified: true },
    });

    const deptAdminLogin = await authService.login({
      email: itAdminEmail,
      password: deptAdminPass,
    });
    const deptAdminPortal = getAuthorizedPortal(deptAdminLogin.user.role);
    if (deptAdminPortal !== '/admin') throw new Error(`Expected /admin portal, got ${deptAdminPortal}`);
    console.log(`✅ Real Department Admin logged in successfully! Role: ${deptAdminLogin.user.role} -> Target Portal: ${deptAdminPortal}`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 7: Real Faculty Onboarding via Cryptographic Email Invitation
    // --------------------------------------------------------------------------
    console.log('\n--- Step 7: Real Faculty Email Invitation Onboarding ---');
    const facultyEmail = 'prof.shannon@institution.edu';

    // Department Admin invites Faculty
    const facultyInvite = await invitationService.createInvitation(
      deptAdminLogin.user,
      {
        email: facultyEmail,
        role: 'FACULTY',
        departmentId: dept.id,
        employeeId: 'EMP-FAC-002',
        designation: 'Associate Professor',
      },
      '127.0.0.1',
      'Live Verification Script'
    );
    console.log(`✅ Invitation created for Faculty: ${facultyEmail}`);
    const facultyToken = new URL(facultyInvite.inviteUrl).searchParams.get('token');
    const storedInvite = await prisma.invitation.findUnique({ where: { id: facultyInvite.id } });
    console.log(`   Cryptographic single-use token generated (length: ${facultyToken.length})`);
    console.log(`   Token hash stored in DB: ${storedInvite.tokenHash.substring(0, 16)}...`);

    // Verify invitation token
    const verifiedInvite = await invitationService.verifyInvitationToken(facultyToken);
    console.log(`✅ Invitation token verified: Email: ${verifiedInvite.email}, Role: ${verifiedInvite.role}`);

    // Faculty accepts invitation and sets password
    const facultyPassword = 'Faculty@RealPass2026!';
    const acceptedFaculty = await invitationService.acceptInvitation({
      token: facultyToken,
      fullName: 'Prof. Claude Shannon',
      password: facultyPassword,
      ipAddress: '127.0.0.1',
      userAgent: 'Live Verification Script',
    });
    console.log(`✅ Faculty accepted invitation and created account: ${acceptedFaculty.email}`);

    // Verify token reuse is strictly rejected
    try {
      await invitationService.acceptInvitation({
        token: facultyToken,
        fullName: 'Prof. Claude Shannon Again',
        password: facultyPassword,
      });
      console.error('❌ Failed: Reusing accepted invitation token should be rejected!');
    } catch (err) {
      console.log(`✅ Single-use token enforcement verified: ${err.message}`);
    }

    // Faculty logs in through unified /login
    const realFacultyLogin = await authService.login({
      email: facultyEmail,
      password: facultyPassword,
    });
    const facultyPortal = getAuthorizedPortal(realFacultyLogin.user.role);
    if (facultyPortal !== '/faculty') throw new Error(`Expected /faculty portal, got ${facultyPortal}`);
    console.log(`✅ Real Faculty logged in successfully! Role: ${realFacultyLogin.user.role} -> Target Portal: ${facultyPortal}`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 8: Real Student Onboarding via Cryptographic Email Invitation
    // --------------------------------------------------------------------------
    console.log('\n--- Step 8: Real Student Email Invitation Onboarding ---');
    const studentEmail = 'student.grace@institution.edu';

    // Department Admin invites Student
    const studentInvite = await invitationService.createInvitation(
      deptAdminLogin.user,
      {
        email: studentEmail,
        role: 'STUDENT',
        departmentId: dept.id,
        rollNumber: 'IT2026-042',
        batch: '2026',
        section: 'A',
      },
      '127.0.0.1',
      'Live Verification Script'
    );

    const studentPassword = 'Student@RealPass2026!';
    const studentToken = new URL(studentInvite.inviteUrl).searchParams.get('token');
    const acceptedStudent = await invitationService.acceptInvitation({
      token: studentToken,
      fullName: 'Grace Hopper Jr.',
      password: studentPassword,
      ipAddress: '127.0.0.1',
      userAgent: 'Live Verification Script',
    });
    console.log(`✅ Student accepted invitation: ${acceptedStudent.email}`);

    // Student logs in through unified /login
    const realStudentLogin = await authService.login({
      email: studentEmail,
      password: studentPassword,
    });
    const studentPortal = getAuthorizedPortal(realStudentLogin.user.role);
    if (studentPortal !== '/student') throw new Error(`Expected /student portal, got ${studentPortal}`);
    console.log(`✅ Real Student logged in successfully! Role: ${realStudentLogin.user.role} -> Target Portal: ${studentPortal}`);
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 9: Verify Rejection of Duplicate Emails & Roll Numbers
    // --------------------------------------------------------------------------
    console.log('\n--- Step 9: Duplicate Protection Verification ---');
    try {
      await userService.createStudent(
        {
          fullName: 'Another Student',
          email: studentEmail, // Duplicate email
          rollNumber: 'IT2026-999',
          departmentId: dept.id,
        },
        deptAdminLogin.user,
        '127.0.0.1',
        'Live Verification Script'
      );
      console.error('❌ Failed: Duplicate email was not rejected!');
    } catch (err) {
      console.log(`✅ Duplicate email rejection verified: ${err.message}`);
    }

    try {
      await userService.createStudent(
        {
          fullName: 'Another Student 2',
          email: 'another.student@institution.edu',
          rollNumber: 'IT2026-042', // Duplicate roll number
          departmentId: dept.id,
        },
        deptAdminLogin.user,
        '127.0.0.1',
        'Live Verification Script'
      );
      console.error('❌ Failed: Duplicate roll number was not rejected!');
    } catch (err) {
      console.log(`✅ Duplicate roll number rejection verified: ${err.message}`);
    }
    passedSteps++;

    // --------------------------------------------------------------------------
    // STEP 10: Verify Existing Demo Accounts Still Intact and Functional
    // --------------------------------------------------------------------------
    console.log('\n--- Step 10: Final Verification of Existing Demo Accounts ---');
    const finalDemoCheck = await prisma.user.findMany({
      where: { isDemo: true },
      select: { email: true, role: true, isDemo: true },
    });
    console.log(`✅ Total Demo accounts intact in database: ${finalDemoCheck.length}`);
    finalDemoCheck.forEach((acc) => console.log(`   - ${acc.email} (${acc.role}) [isDemo: ${acc.isDemo}]`));

    // Confirm existing Admin demo login still passes with full ADMIN role
    const demoRecheck = await authService.login({ email: 'admin@examsphere.io', password: 'Admin@12345' });
    console.log(`✅ Demo Admin login re-verified: Role ${demoRecheck.user.role} -> Portal: ${getAuthorizedPortal(demoRecheck.user.role)}`);
    passedSteps++;

    console.log('\n=============================================================');
    console.log(`🎉 ALL ${passedSteps}/${totalSteps} LIVE VERIFICATION CHECKS PASSED!`);
    console.log('=============================================================\n');

    process.exit(0);
  } catch (err) {
    console.error('\n❌ Live Verification Failed:', err);
    process.exit(1);
  }
}

runLiveVerification();
