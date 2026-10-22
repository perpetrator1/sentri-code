import vm from 'node:vm';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export interface TestCaseInput {
  id: string;
  label: string;
  input: string; // JSON string
  expected: string; // JSON string
  isHidden?: boolean;
}

export interface TestCaseExecutionResult {
  testCaseId: string;
  label: string;
  passed: boolean;
  actual?: string;
  expected?: string;
  error?: string;
  executionTimeMs: number;
  stdout?: string;
  isHidden?: boolean;
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object') {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!deepEqual(a[key], b[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * Executes JavaScript code in an isolated Node.js VM context with strict 2000ms execution limit.
 */
export async function executeJavaScript(
  code: string,
  testCases: TestCaseInput[],
  functionName: string
): Promise<TestCaseExecutionResult[]> {
  const results: TestCaseExecutionResult[] = [];

  for (const tc of testCases) {
    const logs: string[] = [];
    const sandboxConsole = {
      log: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      warn: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
      error: (...args: any[]) => logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')),
    };

    // Isolated sandbox without access to require, process, global, fs, net, fetch
    const sandbox: Record<string, any> = {
      console: sandboxConsole,
      JSON,
      Math,
      Array,
      Object,
      String,
      Number,
      Boolean,
      Map,
      Set,
      Date,
      RegExp,
      parseInt,
      parseFloat,
      isNaN,
      isFinite,
    };

    const context = vm.createContext(sandbox);

    const runnerScript = `
      "use strict";
      ${code}

      const __fn = (typeof ${functionName} === 'function') 
        ? ${functionName} 
        : (typeof twoSum === 'function' ? twoSum : (typeof isAnagram === 'function' ? isAnagram : (typeof merge === 'function' ? merge : null)));

      if (!__fn) {
        throw new Error('Target function "${functionName}" is not defined.');
      }

      const __input = JSON.parse(${JSON.stringify(tc.input)});
      const __res = Array.isArray(__input) ? __fn(...__input) : __fn(__input);
      JSON.stringify(__res);
    `;

    const start = performance.now();
    try {
      const vmResultJson = vm.runInContext(runnerScript, context, {
        timeout: 2000,
        displayErrors: true,
      });
      const end = performance.now();
      const actualVal = JSON.parse(vmResultJson);
      const expectedVal = JSON.parse(tc.expected);
      const passed = deepEqual(actualVal, expectedVal);

      results.push({
        testCaseId: tc.id,
        label: tc.label,
        passed,
        actual: tc.isHidden ? (passed ? '[Correct Output]' : '[Hidden in Evaluation]') : JSON.stringify(actualVal),
        expected: tc.isHidden ? '[Hidden in Evaluation]' : tc.expected,
        executionTimeMs: Number((end - start).toFixed(2)),
        stdout: logs.join('\n'),
        isHidden: tc.isHidden,
      });
    } catch (err: any) {
      const end = performance.now();
      results.push({
        testCaseId: tc.id,
        label: tc.label,
        passed: false,
        error: err.message || 'Execution error',
        executionTimeMs: Number((end - start).toFixed(2)),
        stdout: logs.join('\n'),
        isHidden: tc.isHidden,
      });
    }
  }

  return results;
}

/**
 * Executes Python code by spawning python3 in a clean child process with 2000ms timeout.
 */
export async function executePython(
  code: string,
  testCases: TestCaseInput[],
  functionName: string
): Promise<TestCaseExecutionResult[]> {
  const results: TestCaseExecutionResult[] = [];
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `sentri_py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);

  // Python wrapper script executing test cases
  const pythonWrapper = `
import sys
import json
import time

${code}

test_cases = json.loads(${JSON.stringify(JSON.stringify(testCases))})

results = []
target_fn = globals().get("${functionName}")

if not target_fn:
    # Try finding alternative matching signatures
    for name in ["twoSum", "isAnagram", "merge"]:
        if name in globals() and callable(globals()[name]):
            target_fn = globals()[name]
            break

if not target_fn:
    print(json.dumps({"global_error": 'Function "${functionName}" is not defined.'}))
    sys.exit(0)

for tc in test_cases:
    t_start = time.perf_counter()
    try:
        raw_input = json.loads(tc['input'])
        expected_val = json.loads(tc['expected'])
        
        if isinstance(raw_input, list):
            actual_val = target_fn(*raw_input)
        else:
            actual_val = target_fn(raw_input)
            
        t_end = time.perf_counter()
        passed = actual_val == expected_val
        results.append({
            "testCaseId": tc['id'],
            "label": tc['label'],
            "passed": passed,
            "actual": json.dumps(actual_val),
            "expected": tc['expected'],
            "executionTimeMs": round((t_end - t_start) * 1000, 2),
            "isHidden": tc.get('isHidden', False)
        })
    except Exception as e:
        t_end = time.perf_counter()
        results.append({
            "testCaseId": tc['id'],
            "label": tc['label'],
            "passed": False,
            "error": str(e),
            "executionTimeMs": round((t_end - t_start) * 1000, 2),
            "isHidden": tc.get('isHidden', False)
        })

print(json.dumps({"results": results}))
`;

  try {
    fs.writeFileSync(scriptPath, pythonWrapper, 'utf-8');

    return await new Promise<TestCaseExecutionResult[]>((resolve) => {
      const pyProcess = spawn('python3', [scriptPath], {
        timeout: 2500,
        env: { PATH: process.env.PATH },
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pyProcess.on('close', (code) => {
        try { fs.unlinkSync(scriptPath); } catch (_) {}

        if (code !== 0 && !stdoutData) {
          return resolve(
            testCases.map((tc) => ({
              testCaseId: tc.id,
              label: tc.label,
              passed: false,
              error: stderrData || 'Python execution failed',
              executionTimeMs: 0,
              isHidden: tc.isHidden,
            }))
          );
        }

        try {
          const parsed = JSON.parse(stdoutData.trim());
          if (parsed.global_error) {
            return resolve(
              testCases.map((tc) => ({
                testCaseId: tc.id,
                label: tc.label,
                passed: false,
                error: parsed.global_error,
                executionTimeMs: 0,
                isHidden: tc.isHidden,
              }))
            );
          }
          resolve(parsed.results);
        } catch (e: any) {
          resolve(
            testCases.map((tc) => ({
              testCaseId: tc.id,
              label: tc.label,
              passed: false,
              error: stderrData || stdoutData || 'Could not parse output from Python interpreter',
              executionTimeMs: 0,
              isHidden: tc.isHidden,
            }))
          );
        }
      });

      pyProcess.on('error', (err) => {
        try { fs.unlinkSync(scriptPath); } catch (_) {}
        resolve(
          testCases.map((tc) => ({
            testCaseId: tc.id,
            label: tc.label,
            passed: false,
            error: `Python runner unavailable: ${err.message}`,
            executionTimeMs: 0,
            isHidden: tc.isHidden,
          }))
        );
      });
    });
  } catch (err: any) {
    try { fs.unlinkSync(scriptPath); } catch (_) {}
    return testCases.map((tc) => ({
      testCaseId: tc.id,
      label: tc.label,
      passed: false,
      error: err.message,
      executionTimeMs: 0,
      isHidden: tc.isHidden,
    }));
  }
}
