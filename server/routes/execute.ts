import { Router } from 'express';
import { db } from '../db';
import { executeJavaScript, executePython, type TestCaseInput } from '../runner/codeRunner';

const router = Router();

router.post('/', async (req, res) => {
  const { code, language = 'javascript', problemId, customTestCases, includeHidden = false } = req.body;

  if (!code) {
    return res.status(400).json({ error: 'Source code is required' });
  }

  let testCases: TestCaseInput[] = [];
  let functionName = 'twoSum';

  if (problemId) {
    const problemStmt = db.prepare('SELECT function_name FROM problems WHERE id = ?');
    const problem = problemStmt.get(problemId) as any;
    if (problem) {
      functionName = problem.function_name;
    }

    const testCasesStmt = db.prepare(`
      SELECT id, label, input, expected, is_hidden 
      FROM test_cases 
      WHERE problem_id = ? ${includeHidden ? '' : 'AND is_hidden = 0'}
      ORDER BY is_hidden ASC, created_at ASC
    `);
    const dbCases = testCasesStmt.all(problemId) as any[];

    testCases = dbCases.map((tc) => ({
      id: tc.id,
      label: tc.label,
      input: tc.input,
      expected: tc.expected,
      isHidden: Boolean(tc.is_hidden),
    }));
  }

  if (customTestCases && Array.isArray(customTestCases) && customTestCases.length > 0) {
    testCases = customTestCases;
  }

  if (testCases.length === 0) {
    return res.status(400).json({ error: 'No test cases available to execute.' });
  }

  try {
    let results;
    if (language === 'python') {
      results = await executePython(code, testCases, functionName);
    } else {
      results = await executeJavaScript(code, testCases, functionName);
    }

    const passedCount = results.filter((r) => r.passed).length;
    const score = Math.round((passedCount / results.length) * 100);

    return res.json({
      results,
      summary: {
        total: results.length,
        passed: passedCount,
        failed: results.length - passedCount,
        score,
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      error: err.message || 'Execution failed in sandbox environment',
    });
  }
});

export default router;
