// ==============================================================================
// ExamSphere – Monaco Code Editor & Assessment Panel
// Integrated coding environment with isolated test execution, language switcher,
// sample/hidden test cases viewer, and sandboxed runner status diagnostics.
// ==============================================================================

import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import api from '../../services/api.js';
import {
  Play,
  CheckCircle2,
  XCircle,
  Clock,
  Cpu,
  AlertTriangle,
  RotateCcw,
  Send,
  Loader2,
  FileCode2,
  Terminal,
  HelpCircle,
  Sliders,
  ChevronDown,
  Info,
} from 'lucide-react';

const DEFAULT_STARTER_CODE = {
  javascript: `// JavaScript (Node.js) Solution
function solution(input) {
  // Your code here
  return input;
}
`,
  python: `# Python 3 Solution
def solution(input_data):
    # Your code here
    return input_data
`,
  cpp: `// C++ (GCC) Solution
#include <iostream>
#include <string>
using namespace std;

int main() {
    // Your code here
    return 0;
}
`,
  java: `// Java Solution
import java.util.Scanner;

public class Main {
    public static void main(String[] args) {
        Scanner scanner = new Scanner(System.in);
        // Your code here
    }
}
`,
  c: `// C (GCC) Solution
#include <stdio.h>

int main() {
    // Your code here
    return 0;
}
`,
};

export default function CodeEditorPanel({
  question,
  attemptId,
  examId,
  initialCode = '',
  onCodeChange,
  disabled = false,
}) {
  const detail = question.codingDetail || {};
  const allowedLanguages = detail.allowedLanguages || ['javascript', 'python', 'cpp', 'java'];
  const starterCodeMap = detail.starterCode || DEFAULT_STARTER_CODE;

  const [language, setLanguage] = useState(allowedLanguages[0] || 'javascript');
  const [sourceCode, setSourceCode] = useState(
    initialCode || starterCodeMap[allowedLanguages[0]] || DEFAULT_STARTER_CODE[allowedLanguages[0]] || ''
  );

  const [activeTab, setActiveTab] = useState('problem'); // 'problem' | 'output'
  const [useCustomInput, setUseCustomInput] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [executionResult, setExecutionResult] = useState(null);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);

  // Synchronize when question changes
  useEffect(() => {
    if (initialCode) {
      setSourceCode(initialCode);
    } else {
      const code = starterCodeMap[language] || DEFAULT_STARTER_CODE[language] || '';
      setSourceCode(code);
    }
  }, [question.id, language]);

  const handleLanguageChange = (newLang) => {
    setLanguage(newLang);
    const code = starterCodeMap[newLang] || DEFAULT_STARTER_CODE[newLang] || '';
    setSourceCode(code);
    if (onCodeChange) onCodeChange(code);
  };

  const handleCodeChange = (val) => {
    setSourceCode(val || '');
    if (onCodeChange) onCodeChange(val || '');
  };

  const handleReset = () => {
    const code = starterCodeMap[language] || DEFAULT_STARTER_CODE[language] || '';
    setSourceCode(code);
    if (onCodeChange) onCodeChange(code);
  };

  // Run Code against sample test cases or custom input
  const handleRunCode = async () => {
    setRunning(true);
    setExecutionResult(null);
    setActiveTab('output');
    try {
      const payload = {
        questionId: question.id,
        sourceCode,
        language,
        attemptId,
        customInput: useCustomInput ? customInput : undefined,
      };

      const res = await api.post('/coding/run', payload);
      setExecutionResult(res.data);
      setSelectedCaseIndex(0);
    } catch (err) {
      setExecutionResult({
        status: 'INTERNAL_ERROR',
        message: err.message || 'Execution request failed',
        testResults: [],
      });
    } finally {
      setRunning(false);
    }
  };

  // Submit Solution against all test cases for grading
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    setExecutionResult(null);
    setActiveTab('output');
    try {
      const payload = {
        questionId: question.id,
        sourceCode,
        language,
        attemptId,
        examId,
      };

      const res = await api.post('/coding/submissions', payload);
      setExecutionResult(res.data);
      setSelectedCaseIndex(0);
    } catch (err) {
      setExecutionResult({
        status: 'INTERNAL_ERROR',
        message: err.message || 'Submission request failed',
        testResults: [],
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Sample test cases for problem description view
  const sampleTestCases = (detail.testCases || []).filter((tc) => tc.isSample);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 h-[720px] rounded-2xl overflow-hidden border border-slate-800 bg-slate-navy shadow-2xl">
      {/* Left Column: Problem Statement & Constraints (5 cols) */}
      <div className="lg:col-span-5 flex flex-col border-b lg:border-b-0 lg:border-r border-slate-800 bg-slate-900/60">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('problem')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                activeTab === 'problem'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Problem Details
            </button>
            <button
              onClick={() => setActiveTab('output')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'output'
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-500/20'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Console Output</span>
              {executionResult && (
                <span
                  className={`w-2 h-2 rounded-full ${
                    executionResult.status === 'ACCEPTED'
                      ? 'bg-emerald-400'
                      : 'bg-rose-400'
                  }`}
                />
              )}
            </button>
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400">
            <Clock className="w-3.5 h-3.5 text-blue-400" />
            <span>{detail.timeLimitSec || 2.0}s limit</span>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 text-xs select-text">
          {activeTab === 'problem' ? (
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-100 mb-2">Description</h3>
                <p className="text-slate-300 leading-relaxed whitespace-pre-wrap">
                  {question.questionText}
                </p>
              </div>

              {detail.inputFormat && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    Input Format
                  </h4>
                  <p className="text-slate-400 whitespace-pre-wrap">{detail.inputFormat}</p>
                </div>
              )}

              {detail.outputFormat && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Info className="w-3.5 h-3.5 text-blue-400" />
                    Output Format
                  </h4>
                  <p className="text-slate-400 whitespace-pre-wrap">{detail.outputFormat}</p>
                </div>
              )}

              {detail.constraints && (
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800">
                  <h4 className="font-semibold text-slate-200 mb-1 flex items-center gap-1.5">
                    <Sliders className="w-3.5 h-3.5 text-purple-400" />
                    Constraints
                  </h4>
                  <p className="text-slate-300 font-mono text-[11px] whitespace-pre-wrap">
                    {detail.constraints}
                  </p>
                </div>
              )}

              {/* Sample Test Cases */}
              {sampleTestCases.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-slate-200">Sample Test Cases</h4>
                  {sampleTestCases.map((tc, idx) => (
                    <div
                      key={tc.id || idx}
                      className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2"
                    >
                      <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider">
                        Sample #{idx + 1}
                      </div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[11px]">
                        <div>
                          <span className="text-slate-400 block mb-0.5">Input:</span>
                          <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 overflow-x-auto">
                            {tc.input || '(empty)'}
                          </pre>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">Expected Output:</span>
                          <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 overflow-x-auto">
                            {tc.expectedOutput || '(empty)'}
                          </pre>
                        </div>
                      </div>
                      {tc.explanation && (
                        <p className="text-[11px] text-slate-400 italic pt-1 border-t border-slate-800">
                          Explanation: {tc.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Output / Console View */
            <div className="space-y-4">
              {running || submitting ? (
                <div className="flex flex-col items-center justify-center p-12 text-center text-slate-400 space-y-3">
                  <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                  <p className="font-medium text-slate-300">
                    {running ? 'Running in isolated sandbox...' : 'Evaluating against all test cases...'}
                  </p>
                </div>
              ) : !executionResult ? (
                <div className="p-8 text-center text-slate-500 space-y-2">
                  <Terminal className="w-8 h-8 mx-auto text-slate-600" />
                  <p>Click "Run Code" to test against sample cases or "Submit" for full evaluation.</p>
                </div>
              ) : executionResult.status === 'SETUP_REQUIRED' ? (
                /* Clear setup required notice */
                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm text-amber-300">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />
                    <span>Isolated Code Runner Setup Required</span>
                  </div>
                  <p className="text-xs text-amber-200/90 leading-relaxed">
                    The backend execution service (Judge0) is not configured with a valid endpoint.
                    To enable isolated code execution, set <code className="px-1 py-0.5 bg-slate-900 rounded font-mono text-amber-300">JUDGE0_API_URL</code> in the server environment variables.
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Per security requirements, untrusted candidate code is never run locally on the Express backend host process.
                  </p>
                </div>
              ) : (
                /* Execution Result & Test Case Breakdown */
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-3.5 rounded-xl border flex items-center justify-between ${
                      executionResult.status === 'ACCEPTED'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                        : 'border-rose-500/40 bg-rose-500/10 text-rose-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      {executionResult.status === 'ACCEPTED' ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
                      )}
                      <div>
                        <div className="font-bold text-sm">
                          {executionResult.status === 'ACCEPTED'
                            ? 'Accepted'
                            : executionResult.status.replace(/_/g, ' ')}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          Passed {executionResult.passedTestCases || 0} of{' '}
                          {executionResult.totalTestCases || 0} test cases
                        </div>
                      </div>
                    </div>

                    {executionResult.marksAwarded !== undefined && (
                      <div className="text-right">
                        <div className="text-xs font-mono font-bold text-emerald-400">
                          +{executionResult.marksAwarded} Marks
                        </div>
                        <div className="text-[10px] text-slate-400">
                          out of {executionResult.totalMarks || question.marks}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Test Case Buttons */}
                  {executionResult.testResults && executionResult.testResults.length > 0 && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-1.5 border-b border-slate-800 pb-2">
                        {executionResult.testResults.map((tc, idx) => (
                          <button
                            key={idx}
                            onClick={() => setSelectedCaseIndex(idx)}
                            className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center gap-1.5 transition border ${
                              selectedCaseIndex === idx
                                ? 'bg-blue-600 text-white font-bold border-blue-500 shadow-sm'
                                : tc.passed
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
                            }`}
                          >
                            <span>Case {tc.testCaseIndex}</span>
                            {tc.passed ? (
                              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <XCircle className="w-3 h-3 text-rose-400" />
                            )}
                          </button>
                        ))}
                      </div>

                      {/* Selected Case Inspection */}
                      {executionResult.testResults[selectedCaseIndex] && (
                        <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2.5 font-mono text-[11px]">
                          {/* Case Header */}
                          <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase">
                            <span>
                              Test Case {executionResult.testResults[selectedCaseIndex].testCaseIndex}
                              {executionResult.testResults[selectedCaseIndex].isSample ? ' (Sample)' : ' (Hidden)'}
                            </span>
                            <div className="flex items-center gap-2">
                              {executionResult.testResults[selectedCaseIndex].executionTimeMs !== undefined && (
                                <span>{executionResult.testResults[selectedCaseIndex].executionTimeMs} ms</span>
                              )}
                              {executionResult.testResults[selectedCaseIndex].memoryUsedKb !== undefined && (
                                <span>{executionResult.testResults[selectedCaseIndex].memoryUsedKb} KB</span>
                              )}
                            </div>
                          </div>

                          {executionResult.testResults[selectedCaseIndex].isSample ? (
                            <>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Input:</span>
                                <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 overflow-x-auto">
                                  {executionResult.testResults[selectedCaseIndex].input || '(empty)'}
                                </pre>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Expected Output:</span>
                                <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-slate-200 overflow-x-auto">
                                  {executionResult.testResults[selectedCaseIndex].expectedOutput || '(empty)'}
                                </pre>
                              </div>
                              <div>
                                <span className="text-slate-400 block mb-0.5">Your Output:</span>
                                <pre
                                  className={`p-2 rounded border overflow-x-auto ${
                                    executionResult.testResults[selectedCaseIndex].passed
                                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-semibold'
                                      : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                                  }`}
                                >
                                  {executionResult.testResults[selectedCaseIndex].actualOutput || '(no output)'}
                                </pre>
                              </div>
                            </>
                          ) : (
                            <div className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-slate-300 text-xs">
                              <p className="font-sans">
                                🔒 Hidden test case content is protected for evaluation integrity.
                              </p>
                              <div className="mt-1 font-semibold text-slate-100">
                                Result:{' '}
                                {executionResult.testResults[selectedCaseIndex].passed ? (
                                  <span className="text-emerald-400 font-bold">PASSED</span>
                                ) : (
                                  <span className="text-rose-400">FAILED</span>
                                )}
                              </div>
                            </div>
                          )}

                          {executionResult.testResults[selectedCaseIndex].compileOutput && (
                            <div>
                              <span className="text-amber-400 block mb-0.5 font-bold">Compiler / Error Output:</span>
                              <pre className="p-2 rounded bg-slate-900 border border-slate-800 text-amber-300 overflow-x-auto text-[10px]">
                                {executionResult.testResults[selectedCaseIndex].compileOutput}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Code Editor & Controls (7 cols) */}
      <div className="lg:col-span-7 flex flex-col h-full bg-slate-950">
        {/* Editor Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-2 border-b border-slate-800 bg-slate-900/80">
          <div className="flex items-center gap-3">
            {/* Language Selector */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 font-medium">Language:</span>
              <select
                value={language}
                onChange={(e) => handleLanguageChange(e.target.value)}
                disabled={disabled || running || submitting}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-slate-200 font-medium focus:border-blue-500 focus:outline-none"
              >
                {allowedLanguages.map((lang) => (
                  <option key={lang} value={lang}>
                    {lang === 'javascript' ? 'JavaScript (Node.js)' : lang.toUpperCase()}
                  </option>
                ))}
              </select>
            </div>

            <button
              onClick={handleReset}
              disabled={disabled || running || submitting}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition px-2 py-1 rounded hover:bg-slate-800"
              title="Reset to starter code"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUseCustomInput(!useCustomInput)}
              className={`text-xs px-2.5 py-1 rounded-lg border transition ${
                useCustomInput
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'text-slate-400 hover:text-slate-200 border-slate-700 hover:bg-slate-800'
              }`}
            >
              Custom Input
            </button>
          </div>
        </div>

        {/* Custom Input Drawer if enabled */}
        {useCustomInput && (
          <div className="p-2 border-b border-slate-800 bg-slate-900/60">
            <textarea
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              placeholder="Provide custom STDIN input here..."
              rows={2}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs font-mono text-slate-200 focus:outline-none focus:border-blue-500 resize-none"
            />
          </div>
        )}

        {/* Monaco Editor Container */}
        <div className="flex-1 min-h-[350px]">
          <Editor
            height="100%"
            language={language === 'c' || language === 'cpp' ? 'cpp' : language}
            value={sourceCode}
            theme="vs-dark"
            onChange={handleCodeChange}
            options={{
              readOnly: disabled,
              fontSize: 13,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
              wordWrap: 'on',
              lineNumbers: 'on',
              fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            }}
          />
        </div>

        {/* Editor Bottom Actions */}
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-800 bg-slate-900/80">
          <div className="text-[11px] text-slate-500 font-mono">
            {sourceCode.length} chars / 65536 max
          </div>

          <div className="flex items-center gap-3">
            {/* Run Code Button */}
            <button
              onClick={handleRunCode}
              disabled={disabled || running || submitting}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 border border-emerald-500/30 hover:border-emerald-500/60 transition disabled:opacity-50"
            >
              {running ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
                  <span>Run Code</span>
                </>
              )}
            </button>

            {/* Submit Solution Button */}
            <button
              onClick={handleFinalSubmit}
              disabled={disabled || running || submitting}
              className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold text-xs flex items-center gap-1.5 shadow-lg shadow-blue-500/20 transition disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Evaluating...</span>
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Solution</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
