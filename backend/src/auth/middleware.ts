import type { NextFunction, Request, Response } from 'express';
import { verifyIdToken } from './firebase.js';

export interface AuthUser {
  uid: string;
  name: string;
  email?: string;
}

export interface AuthedRequest extends Request {
  user?: AuthUser;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim() || null;
}

async function attachUser(req: AuthedRequest): Promise<void> {
  const token = bearerToken(req);
  if (!token) return;
  const decoded = await verifyIdToken(token);
  req.user = {
    uid: decoded.uid,
    name:
      (decoded.name as string | undefined) ??
      decoded.email?.split('@')[0] ??
      'Anonymous',
    email: decoded.email,
  };
}

export async function requireAuth(
  req: AuthedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await attachUser(req);
  } catch {
    res.status(401).json({ message: 'Invalid or expired session. Please sign in again.' });
    return;
  }
  if (!req.user) {
    res.status(401).json({ message: 'Sign in to access the Studio.' });
    return;
  }
  next();
}

export async function optionalAuth(
  req: AuthedRequest,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    await attachUser(req);
  } catch {
    // Ignore bad/expired tokens on public routes — treat as anonymous.
  }
  next();
}
