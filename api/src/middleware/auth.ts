import { Request, Response, NextFunction } from 'express';
import { auth } from './firebase.js';

export interface AuthRequest extends Request {
  user?: {
    uid: string;
    email?: string;
  };
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No autorizado' });
  }

  const token = authHeader.split(' ')[1];
  const appPassword = process.env.APP_PASSWORD;

  // Legacy password check (admin mode - no recommended)
  if (token === appPassword) {
    return res.status(401).json({ error: 'Modo admin deshabilitado. Use Firebase Auth.' });
  }

  try {
    const decoded = await auth.verifyIdToken(token);
    req.user = {
      uid: decoded.uid,
      email: decoded.email
    };
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
}
