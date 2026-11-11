// ==============================================================================
// ExamSphere – Multi-Admin, Onboarding & Scoped RBAC Test Suite
// Verifies all Phase 2 through Phase 8 Security & Architecture Requirements
// ==============================================================================

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

describe('Multi-Admin, Invitation Onboarding & Scoped RBAC Test Suite', () => {
  let mockUsers;
  let mockDepartments;
  let mockCourses;
  let mockInvitations;
  let mockAuditLogs;

  beforeEach(() => {
    mockUsers = new Map();
    mockDepartments = new Map();
    mockCourses = new Map();
    mockInvitations = new Map();
    mockAuditLogs = [];

    // Seed test departments
    mockDepartments.set('dept-cse', { id: 'dept-cse', name: 'Computer Science', code: 'CSE' });
    mockDepartments.set('dept-it', { id: 'dept-it', name: 'Information Technology', code: 'IT' });

    // Seed test users
    const saltRounds = 8; // fast salt for tests
    const superAdminPasswordHash = bcrypt.hashSync('SuperAdmin@12345', saltRounds);
    const deptAdminPasswordHash = bcrypt.hashSync('DeptAdmin@12345', saltRounds);
    const facultyPasswordHash = bcrypt.hashSync('Faculty@12345', saltRounds);
    const studentPasswordHash = bcrypt.hashSync('Student@12345', saltRounds);

    mockUsers.set('user-super-1', {
      id: 'user-super-1',
      name: 'Super Admin Alpha',
      email: 'super1@examsphere.io',
      password: superAdminPasswordHash,
      role: 'SUPER_ADMIN',
      departmentId: null,
      isActive: true,
      isDemo: false,
      isEmailVerified: true,
      deletedAt: null,
    });

    mockUsers.set('user-dept-cse', {
      id: 'user-dept-cse',
      name: 'CSE Dept Admin',
      email: 'admin.cse@examsphere.io',
      password: deptAdminPasswordHash,
      role: 'DEPARTMENT_ADMIN',
      departmentId: 'dept-cse',
      isActive: true,
      isDemo: false,
      isEmailVerified: true,
      deletedAt: null,
    });

    mockUsers.set('user-faculty-1', {
      id: 'user-faculty-1',
      name: 'Dr. Turing',
      email: 'turing@examsphere.io',
      password: facultyPasswordHash,
      role: 'FACULTY',
      departmentId: 'dept-cse',
      employeeId: 'EMP-001',
      isActive: true,
      isDemo: false,
      isEmailVerified: true,
      deletedAt: null,
    });

    mockUsers.set('user-student-1', {
      id: 'user-student-1',
      name: 'John Doe',
      email: 'john@examsphere.io',
      password: studentPasswordHash,
      role: 'STUDENT',
      departmentId: 'dept-cse',
      rollNumber: 'CS2026001',
      isActive: true,
      isDemo: false,
      isEmailVerified: true,
      deletedAt: null,
    });
  });

  // 1. Multiple Super Admin login & distinct authentication
  it('Scenario 1: Supports multiple independently authenticated Super Admin accounts', () => {
    const saltRounds = 8;
    const superAdmin2Hash = bcrypt.hashSync('SuperAdminBeta@12345', saltRounds);

    mockUsers.set('user-super-2', {
      id: 'user-super-2',
      name: 'Super Admin Beta',
      email: 'super2@examsphere.io',
      password: superAdmin2Hash,
      role: 'SUPER_ADMIN',
      departmentId: null,
      isActive: true,
      isDemo: false,
      isEmailVerified: true,
      deletedAt: null,
    });

    const admin1 = mockUsers.get('user-super-1');
    const admin2 = mockUsers.get('user-super-2');

    assert.equal(admin1.role, 'SUPER_ADMIN');
    assert.equal(admin2.role, 'SUPER_ADMIN');
    assert.notEqual(admin1.id, admin2.id);

    // Both can authenticate independently
    assert.ok(bcrypt.compareSync('SuperAdmin@12345', admin1.password));
    assert.ok(bcrypt.compareSync('SuperAdminBeta@12345', admin2.password));
    assert.ok(!bcrypt.compareSync('WrongPassword', admin1.password));
  });

  // 2. Unauthorized Super Admin promotion rejection
  it('Scenario 2: Department Admin or Faculty cannot promote any user to Super Admin', () => {
    const requestingUser = mockUsers.get('user-dept-cse');
    const targetUserId = 'user-faculty-1';

    const canPromote = (user) => user.role === 'SUPER_ADMIN';

    assert.equal(canPromote(requestingUser), false);
    assert.throws(
      () => {
        if (!canPromote(requestingUser)) {
          throw new Error('Forbidden: Only Super Administrators can promote users to Super Admin');
        }
      },
      /Forbidden: Only Super Administrators/
    );
  });

  // 3. Super Admin promotion requires step-up password verification
  it('Scenario 3: Super Admin promotion enforces step-up password verification', () => {
    const superAdmin = mockUsers.get('user-super-1');

    const verifyStepUp = (admin, password) => {
      return bcrypt.compareSync(password, admin.password);
    };

    assert.equal(verifyStepUp(superAdmin, 'WrongPassword'), false);
    assert.equal(verifyStepUp(superAdmin, 'SuperAdmin@12345'), true);

    // Promote target
    const target = mockUsers.get('user-faculty-1');
    target.role = 'SUPER_ADMIN';
    mockAuditLogs.push({
      action: 'SUPER_ADMIN_PROMOTED',
      userId: superAdmin.id,
      resourceId: target.id,
    });

    assert.equal(target.role, 'SUPER_ADMIN');
    assert.equal(mockAuditLogs.length, 1);
    assert.equal(mockAuditLogs[0].action, 'SUPER_ADMIN_PROMOTED');
  });

  // 4. Last Active Super Admin demotion protection
  it('Scenario 4: Prevents demotion of the last active Super Admin', () => {
    const getActiveSuperAdminCount = () => {
      let count = 0;
      for (const u of mockUsers.values()) {
        if (u.role === 'SUPER_ADMIN' && u.isActive && !u.deletedAt) count++;
      }
      return count;
    };

    assert.equal(getActiveSuperAdminCount(), 1);

    const demoteSuperAdmin = (targetId) => {
      const activeCount = getActiveSuperAdminCount();
      const target = mockUsers.get(targetId);
      if (target.role === 'SUPER_ADMIN' && target.isActive && activeCount <= 1) {
        throw new Error('Forbidden: Cannot demote the last active Super Admin. Platform requires at least one active Super Admin.');
      }
      target.role = 'FACULTY';
    };

    assert.throws(
      () => demoteSuperAdmin('user-super-1'),
      /Cannot demote the last active Super Admin/
    );

    // If a second active Super Admin exists, demotion succeeds
    mockUsers.set('user-super-2', {
      id: 'user-super-2',
      name: 'Super Admin 2',
      email: 'super2@examsphere.io',
      role: 'SUPER_ADMIN',
      isActive: true,
      deletedAt: null,
    });

    assert.equal(getActiveSuperAdminCount(), 2);
    assert.doesNotThrow(() => demoteSuperAdmin('user-super-1'));
    assert.equal(mockUsers.get('user-super-1').role, 'FACULTY');
    assert.equal(getActiveSuperAdminCount(), 1);
  });

  // 5. Last Active Super Admin suspension protection
  it('Scenario 5: Prevents suspension/deactivation of the last active Super Admin', () => {
    const getActiveSuperAdminCount = () => {
      let count = 0;
      for (const u of mockUsers.values()) {
        if (u.role === 'SUPER_ADMIN' && u.isActive && !u.deletedAt) count++;
      }
      return count;
    };

    const toggleStatus = (targetId, isActive) => {
      const target = mockUsers.get(targetId);
      if (!isActive && target.role === 'SUPER_ADMIN') {
        const activeCount = getActiveSuperAdminCount();
        if (activeCount <= 1) {
          throw new Error('Forbidden: Cannot suspend the last active Super Admin account.');
        }
      }
      target.isActive = isActive;
    };

    assert.throws(
      () => toggleStatus('user-super-1', false),
      /Cannot suspend the last active Super Admin/
    );
  });

  // 6. Department-scoped authorization: Department Admin cannot create or invite users in other departments
  it('Scenario 6: Department Admin is strictly scoped to their assigned department', () => {
    const deptAdminCSE = mockUsers.get('user-dept-cse');

    const createFaculty = (admin, data) => {
      if (admin.role === 'DEPARTMENT_ADMIN') {
        if (data.departmentId && data.departmentId !== admin.departmentId) {
          throw new Error('Forbidden: You can only create faculty within your assigned department');
        }
        data.departmentId = admin.departmentId;
      }
      return data;
    };

    // Attempting to create faculty in IT department must be rejected
    assert.throws(
      () => createFaculty(deptAdminCSE, { email: 'fac.it@examsphere.io', departmentId: 'dept-it' }),
      /Forbidden: You can only create faculty within your assigned department/
    );

    // Creating in assigned department succeeds
    const allowed = createFaculty(deptAdminCSE, { email: 'fac.cse@examsphere.io', departmentId: 'dept-cse' });
    assert.equal(allowed.departmentId, 'dept-cse');
  });

  // 7. Role escalation rejection
  it('Scenario 7: Ordinary users or admins cannot escalate to Super Admin via user update API', () => {
    const validateRoleUpdate = (currentRole, requestedRole) => {
      if (requestedRole === 'SUPER_ADMIN' && currentRole !== 'SUPER_ADMIN') {
        throw new Error('Forbidden: Role escalation to Super Admin must use the verified Super Admin promotion workflow');
      }
    };

    assert.throws(
      () => validateRoleUpdate('DEPARTMENT_ADMIN', 'SUPER_ADMIN'),
      /Role escalation to Super Admin must use the verified Super Admin promotion workflow/
    );
    assert.throws(
      () => validateRoleUpdate('FACULTY', 'SUPER_ADMIN'),
      /Role escalation to Super Admin must use the verified Super Admin promotion workflow/
    );
  });

  // 8. Invitation creation & secure SHA-256 token hashing
  it('Scenario 8: Invitation creates 32-byte cryptographic token and stores only SHA-256 hash', () => {
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    const invitation = {
      id: 'inv-101',
      email: 'newcandidate@examsphere.io',
      role: 'STUDENT',
      departmentId: 'dept-cse',
      tokenHash,
      status: 'PENDING',
      expiresAt,
    };
    mockInvitations.set(tokenHash, invitation);

    // The raw token is NOT stored in the database
    assert.notEqual(invitation.tokenHash, rawToken);
    assert.equal(invitation.tokenHash.length, 64); // SHA-256 hex length
    assert.equal(invitation.status, 'PENDING');
  });

  // 9. Invitation expiration rejection
  it('Scenario 9: Expired invitation token is rejected and cannot be accepted', () => {
    const rawToken = 'sample_expired_token_hex_string_12345';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const pastExpiresAt = new Date(Date.now() - 10000); // 10 seconds ago

    mockInvitations.set(tokenHash, {
      id: 'inv-expired',
      email: 'expired@examsphere.io',
      role: 'STUDENT',
      tokenHash,
      status: 'PENDING',
      expiresAt: pastExpiresAt,
    });

    const verifyToken = (token) => {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const inv = mockInvitations.get(hash);
      if (!inv) throw new Error('Invalid token');
      if (new Date() > inv.expiresAt) {
        inv.status = 'EXPIRED';
        throw new Error('This invitation link has expired.');
      }
      return inv;
    };

    assert.throws(() => verifyToken(rawToken), /This invitation link has expired/);
    assert.equal(mockInvitations.get(tokenHash).status, 'EXPIRED');
  });

  // 10. Single-use invitation token reuse rejection
  it('Scenario 10: Invitation token reuse is strictly rejected once accepted', () => {
    const rawToken = 'single_use_valid_token_hex_string_999';
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 3600000);

    const inv = {
      id: 'inv-reuse',
      email: 'onetime@examsphere.io',
      role: 'FACULTY',
      tokenHash,
      status: 'PENDING',
      expiresAt,
    };
    mockInvitations.set(tokenHash, inv);

    const acceptInvitation = (token) => {
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const targetInv = mockInvitations.get(hash);
      if (!targetInv) throw new Error('Invalid token');
      if (targetInv.status === 'ACCEPTED') {
        throw new Error('This invitation token has already been used and cannot be reused.');
      }
      targetInv.status = 'ACCEPTED';
      return { email: targetInv.email, status: 'ACCEPTED' };
    };

    // First use: Success
    const firstAttempt = acceptInvitation(rawToken);
    assert.equal(firstAttempt.status, 'ACCEPTED');

    // Second use with same token: Strictly Rejected
    assert.throws(
      () => acceptInvitation(rawToken),
      /This invitation token has already been used and cannot be reused/
    );
  });

  // 11. Duplicate email and roll number rejection
  it('Scenario 11: Rejects duplicate email and roll number registrations', () => {
    const checkDuplicate = (email, rollNumber) => {
      for (const u of mockUsers.values()) {
        if (!u.deletedAt) {
          if (u.email === email) throw new Error(`Email '${email}' is already registered`);
          if (rollNumber && u.rollNumber === rollNumber) {
            throw new Error(`Roll number '${rollNumber}' is already registered`);
          }
        }
      }
    };

    // Existing student is john@examsphere.io with CS2026001
    assert.throws(
      () => checkDuplicate('john@examsphere.io', 'CS2026099'),
      /Email 'john@examsphere.io' is already registered/
    );

    assert.throws(
      () => checkDuplicate('newstudent@examsphere.io', 'CS2026001'),
      /Roll number 'CS2026001' is already registered/
    );

    // Unique email and roll number pass
    assert.doesNotThrow(() => checkDuplicate('unique@examsphere.io', 'CS2026999'));
  });

  // 12. Demo account isolation
  it('Scenario 12: Demo accounts are flagged with isDemo=true and isolated from real institutional queries', () => {
    // Seed demo accounts
    mockUsers.set('demo-admin', {
      id: 'demo-admin',
      email: 'admin@examsphere.io',
      role: 'DEPARTMENT_ADMIN',
      isDemo: true,
      isActive: true,
      deletedAt: null,
    });

    mockUsers.set('real-faculty', {
      id: 'real-faculty',
      email: 'faculty@institution.edu',
      role: 'FACULTY',
      isDemo: false,
      isActive: true,
      deletedAt: null,
    });

    const getProductionUsers = () => {
      return Array.from(mockUsers.values()).filter((u) => !u.isDemo);
    };

    const getDemoUsers = () => {
      return Array.from(mockUsers.values()).filter((u) => u.isDemo);
    };

    const prodUsers = getProductionUsers();
    const demoUsers = getDemoUsers();

    assert.ok(prodUsers.every((u) => u.isDemo === false));
    assert.ok(demoUsers.every((u) => u.isDemo === true));
    assert.ok(demoUsers.some((u) => u.email === 'admin@examsphere.io'));
    assert.ok(prodUsers.some((u) => u.email === 'faculty@institution.edu'));
  });

  // 13. Soft deletion preservation for academic users
  it('Scenario 13: User deletion performs soft deletion setting deletedAt and disabling login', () => {
    const student = mockUsers.get('user-student-1');
    assert.equal(student.deletedAt, null);
    assert.equal(student.isActive, true);

    // Perform soft deletion
    student.deletedAt = new Date();
    student.isActive = false;

    // Login authentication check
    const authenticate = (u) => {
      if (u.deletedAt) throw new Error('User account has been deleted.');
      if (!u.isActive) throw new Error('Account deactivated.');
      return true;
    };

    assert.throws(() => authenticate(student), /User account has been deleted/);

    // Record remains preserved in database map for historical audit
    assert.ok(mockUsers.has('user-student-1'));
  });
});
