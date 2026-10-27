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
      JSON.stringify({ val: __res !== undefined ? __res : null, isUndef: __res === undefined });
    `;

    const start = performance.now();
    try {
      const vmResultJson = vm.runInContext(runnerScript, context, {
        timeout: 2000,
        displayErrors: true,
      });
      const end = performance.now();
      const parsedContainer = typeof vmResultJson === 'string' ? JSON.parse(vmResultJson) : { val: null, isUndef: true };
      const actualVal = parsedContainer.isUndef ? undefined : parsedContainer.val;
      const expectedVal = JSON.parse(tc.expected);
      const passed = deepEqual(actualVal, expectedVal);

      results.push({
        testCaseId: tc.id,
        label: tc.label,
        passed,
        actual: tc.isHidden
          ? (passed ? '[Correct Output]' : '[Hidden in Evaluation]')
          : parsedContainer.isUndef
          ? 'undefined'
          : JSON.stringify(actualVal),
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
  const tmpDir = os.tmpdir();
  const scriptPath = path.join(tmpDir, `sentri_py_${Date.now()}_${Math.random().toString(36).slice(2)}.py`);

  // Python wrapper script executing test cases with captured stdout and tuple/list normalization
  const pythonWrapper = `
import sys
import json
import time
import io

def _normalize(val):
    if isinstance(val, (tuple, list)):
        return [_normalize(x) for x in val]
    if isinstance(val, dict):
        return {k: _normalize(v) for k, v in val.items()}
    return val

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as init_err:
    print("__SENTRI_EXEC_JSON_START__")
    print(json.dumps({"global_error": f"Script Initialization Error: {str(init_err)}"}))
    print("__SENTRI_EXEC_JSON_END__")
    sys.exit(0)

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
    print("__SENTRI_EXEC_JSON_START__")
    print(json.dumps({"global_error": 'Function "${functionName}" is not defined.'}))
    print("__SENTRI_EXEC_JSON_END__")
    sys.exit(0)

real_stdout = sys.stdout

for tc in test_cases:
    capture_buffer = io.StringIO()
    sys.stdout = capture_buffer
    t_start = time.perf_counter()
    try:
        raw_input = json.loads(tc['input'])
        expected_val = json.loads(tc['expected'])
        
        if isinstance(raw_input, list):
            actual_val = target_fn(*raw_input)
        else:
            actual_val = target_fn(raw_input)
            
        t_end = time.perf_counter()
        sys.stdout = real_stdout
        captured_logs = capture_buffer.getvalue()

        norm_actual = _normalize(actual_val)
        norm_expected = _normalize(expected_val)
        passed = norm_actual == norm_expected

        try:
            actual_str = json.dumps(actual_val)
        except Exception:
            actual_str = str(actual_val)

        results.append({
            "testCaseId": tc['id'],
            "label": tc['label'],
            "passed": passed,
            "actual": actual_str,
            "expected": tc['expected'],
            "executionTimeMs": round((t_end - t_start) * 1000, 2),
            "stdout": captured_logs,
            "isHidden": tc.get('isHidden', False)
        })
    except Exception as e:
        t_end = time.perf_counter()
        sys.stdout = real_stdout
        captured_logs = capture_buffer.getvalue()
        results.append({
            "testCaseId": tc['id'],
            "label": tc['label'],
            "passed": False,
            "error": str(e),
            "executionTimeMs": round((t_end - t_start) * 1000, 2),
            "stdout": captured_logs,
            "isHidden": tc.get('isHidden', False)
        })
    finally:
        sys.stdout = real_stdout

print("__SENTRI_EXEC_JSON_START__")
print(json.dumps({"results": results}))
print("__SENTRI_EXEC_JSON_END__")
`;

  try {
    fs.writeFileSync(scriptPath, pythonWrapper, 'utf-8');

    return await new Promise<TestCaseExecutionResult[]>((resolve) => {
      const pythonCmd = 'python3';
      const pyProcess = spawn(pythonCmd, [scriptPath], {
        timeout: 2500,
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
      });

      let stdoutData = '';
      let stderrData = '';

      pyProcess.stdout.on('data', (chunk) => {
        stdoutData += chunk.toString();
      });

      pyProcess.stderr.on('data', (chunk) => {
        stderrData += chunk.toString();
      });

      pyProcess.on('close', (code, signal) => {
        try { fs.unlinkSync(scriptPath); } catch (_) {}

        if (signal === 'SIGTERM') {
          return resolve(
            testCases.map((tc) => ({
              testCaseId: tc.id,
              label: tc.label,
              passed: false,
              error: 'Execution Timed Out (>2500ms). Terminated by sandbox.',
              executionTimeMs: 2500,
              isHidden: tc.isHidden,
            }))
          );
        }

        // Extract JSON between sentinel tokens
        let jsonPayload = '';
        const startToken = '__SENTRI_EXEC_JSON_START__';
        const endToken = '__SENTRI_EXEC_JSON_END__';
        const startIdx = stdoutData.indexOf(startToken);
        const endIdx = stdoutData.indexOf(endToken);

        if (startIdx !== -1 && endIdx !== -1 && endIdx > startIdx) {
          jsonPayload = stdoutData.slice(startIdx + startToken.length, endIdx).trim();
        } else {
          jsonPayload = stdoutData.trim();
        }

        if (!jsonPayload && code !== 0) {
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
          const parsed = JSON.parse(jsonPayload);
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
