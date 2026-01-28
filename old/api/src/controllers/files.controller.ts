import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { AuthRequest } from '../middleware/auth.js';

const STORAGE_ROOT = path.resolve(process.cwd(), '../storage_data');
// Ajuste de path: process.cwd() en ejecución api/ suele ser api/. data estaria en ../storage_data relativo a api root, o ../../storage_data relativo a src
// Mejor usar absoluta basada en __dirname
const __dirname = path.dirname(new URL(import.meta.url).pathname);
// Oops, __dirname no existe en ESM.
// Usaremos process.env.STORAGE_PATH o fallback relativo.
const STORAGE_PATH = process.env.STORAGE_PATH || path.resolve(process.cwd(), 'storage_files');
// Nota: El usuario guardaba en Documentos/Griego2/storage.
// Si estoy en /home/stev/Documentos/Griego2/api, storage está en ../storage (o ../storage_data como puse antes).
// Voy a usar ../storage para alinearme con legacy.

const FINAL_STORAGE = path.resolve(process.cwd(), '../storage');

if (!fs.existsSync(FINAL_STORAGE)) {
  fs.mkdirSync(FINAL_STORAGE, { recursive: true });
}

export const listFiles = async (req: AuthRequest, res: Response) => {
  try {
    const userDir = path.join(FINAL_STORAGE, req.user!.uid);
    // Ruta relativa solicitada (query param path)
    const relativePath = (req.query.path as string) || '';
    
    // Evitar Directory Traversal
    const targetPath = path.resolve(userDir, relativePath);
    if (!targetPath.startsWith(userDir)) {
         // Si no existe carpeta de usuario, crearla si es raíz
         if (relativePath === '' && !fs.existsSync(userDir)) {
             fs.mkdirSync(userDir, { recursive: true });
         } else if (!fs.existsSync(userDir)) {
             // Si el usuario no tiene carpeta y pide algo, es 404/403.
             // Pero para first run, mejor crearla.
             fs.mkdirSync(userDir, { recursive: true });
         }
         
         // Re-check traversal
         if (!targetPath.startsWith(userDir)) return res.status(403).json({ error: 'Invalid path' });
    }

    if (!fs.existsSync(targetPath)) {
        if (targetPath === userDir) {
             fs.mkdirSync(userDir, { recursive: true });
        } else {
             return res.status(404).json({ error: 'Path not found' });
        }
    }

    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    
    const responseItems = items.map(item => ({
        name: item.name,
        type: item.isDirectory() ? 'folder' : 'file',
        size: item.isDirectory() ? 0 : fs.statSync(path.join(targetPath, item.name)).size
    }));

    res.json({ path: relativePath, items: responseItems });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createFolder = async (req: AuthRequest, res: Response) => {
    try {
        const { folderName, currentPath } = req.body;
        const userDir = path.join(FINAL_STORAGE, req.user!.uid);
        const targetPath = path.resolve(userDir, currentPath || '', folderName);

        if (!targetPath.startsWith(userDir)) {
            return res.status(403).json({ error: 'Invalid path' });
        }

        if (fs.existsSync(targetPath)) {
            return res.status(400).json({ error: 'Folder already exists' });
        }

        fs.mkdirSync(targetPath);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: String(error) });
    }
};