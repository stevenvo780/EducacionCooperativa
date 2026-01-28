import { Router, Request, Response } from 'express';
import { auth, db } from '../firebase.js';

const router = Router();

// Google Auth Token Exchange
router.post('/auth/google', async (req: Request, res: Response) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.status(400).json({ error: 'Falta idToken' });

    const decoded = await auth.verifyIdToken(idToken);
    
    res.json({
      success: true,
      user: { uid: decoded.uid, email: decoded.email }
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(401).json({ error: 'Token inválido' });
  }
});

// Register new user
router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Faltan datos' });
    }

    const user = await auth.createUser({
      email,
      password,
      displayName: name,
      emailVerified: false
    });

    res.json({
      success: true,
      userId: user.uid
    });
  } catch (error: any) {
    console.error('Register error:', error);
    res.status(400).json({ error: error.message || 'Error al registrar' });
  }
});

// Legacy login (deprecated)
router.post('/login', async (req: Request, res: Response) => {
  res.status(410).json({ 
    error: 'Endpoint deprecado. Use Firebase Auth en el cliente.' 
  });
});

export default router;
