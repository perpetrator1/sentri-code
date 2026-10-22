import { Router } from 'express';
import { db } from '../db';

const router = Router();

// GET all problems
router.get('/', (req, res) => {
  const problemsStmt = db.prepare('SELECT * FROM problems ORDER BY created_at ASC');
  const rawProblems = problemsStmt.all() as any[];

  const testCasesStmt = db.prepare('SELECT * FROM test_cases WHERE is_hidden = 0 ORDER BY created_at ASC');
  const allVisibleTestCases = testCasesStmt.all() as any[];

  const problems = rawProblems.map((p) => {
    return {
      id: p.id,
      title: p.title,
      difficulty: p.difficulty,
      category: p.category,
      timeLimitMins: p.time_limit_mins,
      description: p.description,
      constraints: p.constraints.split('\n'),
      starterCode: JSON.parse(p.starter_code_json),
      functionName: p.function_name,
      testCases: allVisibleTestCases
        .filter((tc) => tc.problem_id === p.id)
        .map((tc) => ({
          id: tc.id,
          label: tc.label,
          input: tc.input,
          expected: tc.expected,
        })),
    };
  });

  res.json({ problems });
});

// GET single problem by ID (including hidden test case count)
router.get('/:id', (req, res) => {
  const problemStmt = db.prepare('SELECT * FROM problems WHERE id = ?');
  const problem = problemStmt.get(req.params.id) as any;

  if (!problem) {
    return res.status(404).json({ error: 'Problem not found' });
  }

  const testCasesStmt = db.prepare('SELECT * FROM test_cases WHERE problem_id = ? ORDER BY is_hidden ASC, created_at ASC');
  const allCases = testCasesStmt.all() as any[];

  const visibleCases = allCases.filter(tc => !tc.is_hidden).map(tc => ({
    id: tc.id,
    label: tc.label,
    input: tc.input,
    expected: tc.expected,
  }));

  const hiddenCount = allCases.filter(tc => tc.is_hidden).length;

  res.json({
    problem: {
      id: problem.id,
      title: problem.title,
      difficulty: problem.difficulty,
      category: problem.category,
      timeLimitMins: problem.time_limit_mins,
      description: problem.description,
      constraints: problem.constraints.split('\n'),
      starterCode: JSON.parse(problem.starter_code_json),
      functionName: problem.function_name,
      testCases: visibleCases,
      hiddenEvaluationCount: hiddenCount,
    },
  });
});

export default router;
