import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export const JWT_SECRET = process.env.JWT_SECRET || 'sentri-code-offline-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'candidate' | 'examiner' | 'admin';
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  // Offline / Demo fallback authentication support
  if (token === 'offline-examiner-token' || token === 'offline-token') {
    req.user = {
      id: 'exam-offline-1',
      email: 'professor@sentri.dev',
      name: 'Prof. Henderson (Offline)',
      role: 'examiner',
    };
    return next();
  }
  if (token === 'offline-candidate-token') {
    req.user = {
      id: 'cand-offline-77',
      email: 'candidate@sentri.dev',
      name: 'Alex Rivera (Offline)',
      role: 'candidate',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

export function requireRole(...roles: Array<'candidate' | 'examiner' | 'admin'>) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden: role '${req.user.role}' lacks permission.` });
    }
    next();
  };
}
