'use client';

import React, { useEffect, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Cloud, Check, Eye, EyeOff, Columns, File as FileIcon, Download } from 'lucide-react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';

interface EditorProps {
  initialContent?: string;
  roomId: string; 
}

export default function Editor({ initialContent = '', roomId }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  useEffect(() => {
    if (!roomId) return;
    const docRef = doc(db, 'documents', roomId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.type === 'file') {
            setDocType('file');
            setFileUrl(data.url);
            setContent(data.name || 'File');
        } else {
            if (data.content !== undefined && data.lastUpdatedBy !== auth.currentUser?.uid) {
               setContent(data.content);
            }
        }
      } else {
        setDoc(docRef, { 
            content: initialContent, 
            type: 'text',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp() 
        });
      }
    });
    return () => unsubscribe();
  }, [roomId, initialContent]);

  const onChange = useCallback(async (val: string) => {
    setContent(val);
    setSaving(true);
    if (!roomId) return;
    const docRef = doc(db, 'documents', roomId);
    try {
        await setDoc(docRef, { 
            content: val, 
            updatedAt: serverTimestamp(),
            lastUpdatedBy: auth.currentUser?.uid 
        }, { merge: true });
    } catch (e) {
        console.error("Error updating document:", e);
    } finally {
        setTimeout(() => setSaving(false), 500); 
    }
  }, [roomId]);

  if (docType === 'file' && fileUrl) {
      return (
        <div className="flex flex-col h-screen bg-slate-50">
             <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4">
                <Link href="/dashboard" className="flex items-center text-slate-500 hover:text-blue-600 gap-1 font-medium">
                    <ChevronLeft className="w-5 h-5" /> Volver
                </Link>
                <div className="font-bold text-slate-700">{content}</div>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-sm">
                    <Download className="w-4 h-4" /> Descargar
                </a>
             </div>
             <div className="flex-1 flex items-center justify-center p-8">
                {/* Basic iframe for PDF/HTML/Images */}
                <iframe src={fileUrl} className="w-full h-full border border-slate-200 rounded-lg shadow-sm bg-white" title="File Viewer" />
             </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4 text-white">
        <div className="flex items-center gap-4">
            <Link 
                href="/dashboard"
                className="flex items-center text-slate-400 hover:text-white transition gap-1 text-sm font-medium"
            >
                <ChevronLeft className="w-4 h-4" />
                Volver
            </Link>
            <div className="h-6 w-px bg-slate-700"></div>
            <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded transition ${showPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >
                {showPreview ? <Columns className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                {showPreview ? 'Split View' : 'Editor Only'}
            </button>
        </div>
        
        <div className="flex items-center gap-2 text-xs text-slate-400">
            {saving ? (
                <>
                    <Cloud className="w-3 h-3 animate-pulse" />
                    Guardando...
                </>
            ) : (
                <>
                    <Check className="w-3 h-3 text-green-500" />
                    Guardado
                </>
            )}
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden flex">
        <div className={`${showPreview ? 'w-1/2 border-r border-slate-700' : 'w-full'} h-full transition-all duration-300`}>
            <CodeMirror
                value={content}
                height="100%"
                extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                onChange={onChange}
                theme="dark" 
                className="text-base h-full"
            />
        </div>
        {showPreview && (
            <div className="w-1/2 h-full overflow-auto bg-white text-slate-900 p-8 prose prose-slate max-w-none">
                <ReactMarkdown 
                    remarkPlugins={[remarkMath]} 
                    rehypePlugins={[rehypeKatex]}
                >
                    {content}
                </ReactMarkdown>
            </div>
        )}
      </div>
    </div>
  );
}
