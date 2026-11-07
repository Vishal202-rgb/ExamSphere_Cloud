// ==============================================================================
// ExamSphere – Secure Code Execution Service Abstraction
// Interfaces with sandboxed execution engines (Judge0 API)
// NEVER executes untrusted student code in the Express process or on host.
// If provider is unconfigured, reports SETUP_REQUIRED without insecure fallbacks.
// ==============================================================================

import { env } from '../../config/env.js';

// Map of canonical language names to Judge0 Language IDs
export const JUDGE0_LANGUAGE_IDS = {
  javascript: 63, // Node.js (v12+ / v18+)
  python: 71,     // Python (3.8+ / 3.10+)
  cpp: 54,        // C++ (GCC 9.2.0)
  c: 50,          // C (GCC 9.2.0)
  java: 62,       // Java (OpenJDK 13/17)
};

class CodeExecutionService {
  constructor() {
    this.apiUrl = process.env.JUDGE0_API_URL || null;
    this.apiKey = process.env.JUDGE0_API_KEY || null;
  }

  /**
   * Check if external sandboxed code execution provider is configured
   */
  isConfigured() {
    return Boolean(this.apiUrl && this.apiUrl.trim().length > 0);
  }

  /**
   * Execute code snippet against a specific test case input
   * @param {Object} params
   * @param {string} params.sourceCode
   * @param {string} params.language - 'javascript', 'python', 'cpp', 'c', 'java'
   * @param {string} params.stdin - test case input string
   * @param {string} params.expectedOutput - expected output string (for diffing)
   * @param {number} params.timeLimitSec - time limit in seconds
   * @param {number} params.memoryLimitMb - memory limit in megabytes
   */
  async executeTestCase({
    sourceCode,
    language,
    stdin = '',
    expectedOutput = '',
    timeLimitSec = 2.0,
    memoryLimitMb = 256,
  }) {
    // 1. Invariant: Check if sandbox provider is configured
    if (!this.isConfigured()) {
      return {
        status: 'SETUP_REQUIRED',
        passed: false,
        actualOutput: '',
        expectedOutput,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        compileOutput: '',
        errorMessage:
          'Sandboxed code execution provider (Judge0) is not configured. Please configure JUDGE0_API_URL in server environment variables to enable isolated test execution.',
      };
    }

    // 2. Validate language support
    const normalizedLang = (language || '').toLowerCase().trim();
    const languageId = JUDGE0_LANGUAGE_IDS[normalizedLang];
    if (!languageId) {
      return {
        status: 'INTERNAL_ERROR',
        passed: false,
        actualOutput: '',
        expectedOutput,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        compileOutput: '',
        errorMessage: `Language '${language}' is not supported by the configured execution provider. Supported: ${Object.keys(JUDGE0_LANGUAGE_IDS).join(', ')}`,
      };
    }

    // 3. Payload validation
    if (!sourceCode || sourceCode.length > 65536) {
      return {
        status: 'INTERNAL_ERROR',
        passed: false,
        actualOutput: '',
        expectedOutput,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        compileOutput: '',
        errorMessage: 'Source code exceeds maximum permitted length of 64KB',
      };
    }

    // 4. Dispatch request to isolated Judge0 sandbox
    try {
      const headers = {
        'Content-Type': 'application/json',
      };
      if (this.apiKey) {
        headers['X-RapidAPI-Key'] = this.apiKey;
        headers['X-Auth-Token'] = this.apiKey;
      }

      const payload = {
        language_id: languageId,
        source_code: Buffer.from(sourceCode).toString('base64'),
        stdin: Buffer.from(stdin || '').toString('base64'),
        expected_output: expectedOutput ? Buffer.from(expectedOutput).toString('base64') : undefined,
        cpu_time_limit: Math.min(Math.max(timeLimitSec, 0.5), 10.0),
        memory_limit: Math.min(Math.max(memoryLimitMb * 1024, 32768), 512000), // KB
      };

      const endpoint = `${this.apiUrl.replace(/\/+$/, '')}/submissions?wait=true&base64_encoded=true`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(Math.ceil((timeLimitSec + 5) * 1000)),
      });

      const result = await response.json();

      // Decode base64 responses safely
      const decodeB64 = (val) => (val ? Buffer.from(val, 'base64').toString('utf-8') : '');

      const stdout = decodeB64(result.stdout);
      const stderr = decodeB64(result.stderr);
      const compileOutput = decodeB64(result.compile_output);
      const timeMs = result.time ? Math.round(parseFloat(result.time) * 1000) : 0;
      const memoryKb = result.memory || 0;

      // Judge0 Status IDs:
      // 1: In Queue, 2: Processing, 3: Accepted, 4: Wrong Answer,
      // 5: Time Limit Exceeded, 6: Compilation Error, 7-12: Runtime Error, 13-14: Internal Error
      const statusId = result.status?.id;

      let status = 'ACCEPTED';
      let passed = false;

      if (statusId === 3) {
        status = 'ACCEPTED';
        passed = true;
      } else if (statusId === 4) {
        status = 'WRONG_ANSWER';
      } else if (statusId === 5) {
        status = 'TIME_LIMIT_EXCEEDED';
      } else if (statusId === 6) {
        status = 'COMPILATION_ERROR';
      } else if (statusId >= 7 && statusId <= 12) {
        status = 'RUNTIME_ERROR';
      } else {
        status = 'INTERNAL_ERROR';
      }

      // Output string normalization for comparison
      const cleanActual = (stdout || '').trimEnd().replace(/\r\n/g, '\n');
      const cleanExpected = (expectedOutput || '').trimEnd().replace(/\r\n/g, '\n');

      if (status === 'ACCEPTED' || (!result.status && cleanActual === cleanExpected)) {
        passed = cleanActual === cleanExpected;
        if (!passed) status = 'WRONG_ANSWER';
      }

      return {
        status,
        passed,
        actualOutput: cleanActual,
        expectedOutput: cleanExpected,
        executionTimeMs: timeMs,
        memoryUsedKb: memoryKb,
        compileOutput: compileOutput || stderr || '',
        errorMessage: stderr || (status !== 'ACCEPTED' ? result.status?.description : null),
      };
    } catch (error) {
      if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
        return {
          status: 'TIME_LIMIT_EXCEEDED',
          passed: false,
          actualOutput: '',
          expectedOutput,
          executionTimeMs: Math.round(timeLimitSec * 1000),
          memoryUsedKb: 0,
          compileOutput: '',
          errorMessage: 'Execution timed out waiting for the sandboxed runner response.',
        };
      }

      return {
        status: 'INTERNAL_ERROR',
        passed: false,
        actualOutput: '',
        expectedOutput,
        executionTimeMs: 0,
        memoryUsedKb: 0,
        compileOutput: '',
        errorMessage: `Code execution service error: ${error.message}`,
      };
    }
  }
}

export const codeExecutionService = new CodeExecutionService();
