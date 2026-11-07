// ==============================================================================
// ExamSphere – API Endpoint Route & Security Validation Test Suite
// Verifies HTTP headers, authentication guardrails, and request validation
// ==============================================================================

import test, { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/app.js';
import { prisma } from '../src/config/db.js';
import { redis } from '../src/config/redis.js';

describe('HTTP Route Security & Validation Layer', () => {
  it('Reject unauthenticated POST /api/v1/exams/:id/start with 401 Unauthorized', async () => {
    const res = await request(app).post('/api/v1/exams/11111111-1111-1111-1111-111111111111/start');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('Reject unauthenticated GET /api/v1/attempts/:attemptId/time with 401 Unauthorized', async () => {
    const res = await request(app).get('/api/v1/attempts/11111111-1111-1111-1111-111111111111/time');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('Reject unauthenticated PUT /api/v1/attempts/:attemptId/answers/:questionId with 401', async () => {
    const res = await request(app)
      .put('/api/v1/attempts/11111111-1111-1111-1111-111111111111/answers/22222222-2222-2222-2222-222222222222')
      .send({ selectedOptions: [] });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('Reject unauthenticated POST /api/v1/attempts/:attemptId/submit with 401', async () => {
    const res = await request(app)
      .post('/api/v1/attempts/11111111-1111-1111-1111-111111111111/submit')
      .send({ reason: 'MANUAL' });
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  it('Reject unauthenticated GET /api/v1/student/exams with 401', async () => {
    const res = await request(app).get('/api/v1/student/exams');
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  after(async () => {
    await prisma.$disconnect().catch(() => {});
    if (redis.status === 'ready' || redis.status === 'connect') {
      await redis.quit().catch(() => {});
    }
  });
});
