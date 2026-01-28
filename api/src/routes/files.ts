import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import * as FilesController from '../controllers/files.controller.js';
import multer from 'multer';

const router = Router();

// Configurar storage temporal o directo.
const upload = multer({ dest: 'uploads/temp/' });

router.use(authMiddleware);

// GET /api/files?path=...
router.get('/files', FilesController.listFiles);

// POST /api/folder
router.post('/folder', FilesController.createFolder);

export default router;
    // Personal files
    const personalPrefix = `users/${uid}/`;
    const [personalBlobs] = await bucket.getFiles({ prefix: personalPrefix });
    
    for (const blob of personalBlobs) {
      const relativeName = blob.name.slice(personalPrefix.length);
      if (relativeName && !relativeName.endsWith('/')) {
        files.push(`Mis Archivos/${relativeName}`);
      }
    }

    // Group files
    for (const group of groups) {
      const groupPrefix = `groups/${group.id}/`;
      const [groupBlobs] = await bucket.getFiles({ prefix: groupPrefix });
      
      for (const blob of groupBlobs) {
        const relativeName = blob.name.slice(groupPrefix.length);
        if (relativeName && !relativeName.endsWith('/')) {
          files.push(`Espacios de Trabajo/${group.name}/${relativeName}`);
        }
      }
    }

    files.sort();
    res.json(files);
  } catch (error) {
    console.error('Error listing files:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Get file content
router.get('/file', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const path = req.query.path as string;
    if (!path) return res.status(400).json({ error: 'Falta path' });

    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });

    const groups = await getUserGroups(uid, email);
    const realPath = resolveStoragePath(path, uid, groups);
    
    if (!realPath) {
      return res.status(403).json({ error: 'Sin acceso a esta ruta' });
    }

    const file = bucket.file(realPath);
    const [exists] = await file.exists();
    
    if (!exists) {
      return res.status(404).json({ error: 'Archivo no encontrado' });
    }

    const [content] = await file.download();
    res.json({ content: content.toString('utf-8') });
  } catch (error) {
    console.error('Error getting file:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

// Save file
router.post('/save', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { path, content } = req.body;
    if (!path || content === undefined) {
      return res.status(400).json({ error: 'Datos incompletos' });
    }

    const uid = req.user?.uid;
    const email = req.user?.email;
    if (!uid) return res.status(401).json({ error: 'No autorizado' });

    const groups = await getUserGroups(uid, email);
    const realPath = resolveStoragePath(path, uid, groups);
    
    if (!realPath) {
      return res.status(403).json({ error: 'Sin permiso para guardar aquí' });
    }

    const file = bucket.file(realPath);
    await file.save(content, { contentType: 'text/plain; charset=utf-8' });
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving file:', error);
    res.status(500).json({ error: 'Error interno' });
  }
});

export default router;
