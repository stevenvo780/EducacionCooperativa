import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import { adminAuth } from '@/lib/firebase-admin';

// NOTE: For Vercel deployment, local filesystem (fs) is ephemeral. 
// You should switch to Firebase Storage or AWS S3 for production on Vercel.
// This works for Docker with persistent volumes.
const STORAGE_ROOT = process.env.STORAGE_PATH || path.resolve(process.cwd(), '../storage');

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  
  if (!token) {
     return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let uid;
  try {
     const decoded = await adminAuth?.verifyIdToken(token);
     uid = decoded?.uid;
  } catch (e) {
     return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  if (!uid) return NextResponse.json({ error: 'User not found' }, { status: 401 });

  const searchParams = req.nextUrl.searchParams;
  const relativePath = searchParams.get('path') || '';
  
  // Security: prevent path traversal
  const safePath = relativePath.replace(/^(\.\.(\/|\\|$))+/, '');
  const userDir = path.join(STORAGE_ROOT, uid);
  const targetPath = path.resolve(userDir, safePath);

  if (!targetPath.startsWith(userDir)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
  }

  try {
    if (!fs.existsSync(userDir)) {
      fs.mkdirSync(userDir, { recursive: true });
    }

    if (!fs.existsSync(targetPath)) {
      return NextResponse.json({ items: [] }); // Return empty if path doesn't exist yet
    }

    const items = fs.readdirSync(targetPath, { withFileTypes: true });
    
    const responseItems = items.map(item => ({
      name: item.name,
      type: item.isDirectory() ? 'folder' : 'file',
      size: item.isDirectory() ? 0 : fs.statSync(path.join(targetPath, item.name)).size
    }));

    return NextResponse.json({ path: relativePath, items: responseItems });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const token = req.headers.get('Authorization')?.split('Bearer ')[1];
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let uid;
  try {
     const decoded = await adminAuth?.verifyIdToken(token);
     uid = decoded?.uid;
  } catch (e) {
     return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }

  try {
    const { folderName, currentPath } = await req.json();
    
    const userDir = path.join(STORAGE_ROOT, uid!);
    const safePath = (currentPath || '').replace(/^(\.\.(\/|\\|$))+/, ''); 
    const targetPath = path.resolve(userDir, safePath, folderName);

    if (!targetPath.startsWith(userDir)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    if (fs.existsSync(targetPath)) {
      return NextResponse.json({ error: 'Folder already exists' }, { status: 400 });
    }

    fs.mkdirSync(targetPath, { recursive: true });
    return NextResponse.json({ success: true, path: path.join(safePath, folderName) });

  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
