import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { generateToken, authMiddleware, type AuthUser } from '../middleware/auth';

const router = Router();

// Login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const stmt = db.prepare('SELECT * FROM users WHERE email = ?');
  const user = stmt.get(email.trim().toLowerCase()) as any;

  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password.' });
  }

  const authUser: AuthUser = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };

  const token = generateToken(authUser);
  return res.json({ user: authUser, token });
});

// Register
router.post('/register', (req, res) => {
  const { email, password, name, role = 'candidate' } = req.body;
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required.' });
  }

  const existingStmt = db.prepare('SELECT id FROM users WHERE email = ?');
  if (existingStmt.get(email.trim().toLowerCase())) {
    return res.status(409).json({ error: 'An account with this email already exists.' });
  }

  const allowedRoles = ['candidate', 'examiner', 'admin'];
  const userRole = allowedRoles.includes(role) ? role : 'candidate';

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(password, salt);
  const id = `usr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();

  const insertStmt = db.prepare(`
    INSERT INTO users (id, email, password_hash, name, role, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  insertStmt.run(id, email.trim().toLowerCase(), passwordHash, name.trim(), userRole, now);

  const authUser: AuthUser = {
    id,
    email: email.trim().toLowerCase(),
    name: name.trim(),
    role: userRole as any,
  };

  const token = generateToken(authUser);
  return res.status(201).json({ user: authUser, token });
});

// Current User Profile
router.get('/me', authMiddleware, (req, res) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const stmt = db.prepare('SELECT id, email, name, role, created_at FROM users WHERE id = ?');
  const user = stmt.get(req.user.id);
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  return res.json({ user });
});

export default router;
