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
  onClose?: () => void;
}

export default function Editor({ initialContent = '', roomId, onClose }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showExport, setShowExport] = useState(false);

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

  const insertText = (text: string) => {
      // Simple append for now - ideal would be cursor position insertion
      const newVal = content + text;
      onChange(newVal);
  };

  const handleExport = (type: 'md' | 'html') => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${roomId}.${type === 'md' ? 'md' : 'html'}`; // simplified
      a.click();
      setShowExport(false);
  };

  if (docType === 'file' && fileUrl) {
      return (
        <div className="flex flex-col h-full bg-slate-50">
             <div className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-4">
                <button onClick={onClose} className="flex items-center text-slate-500 hover:text-blue-600 gap-1 font-medium text-sm">
                    <ChevronLeft className="w-5 h-5" /> Cerrar
                </button>
                <div className="font-bold text-slate-700 truncate px-4">{content}</div>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="flex items-center gap-2 bg-blue-600 text-white px-3 py-1.5 rounded-lg hover:bg-blue-700 transition text-sm">
                    <Download className="w-4 h-4" /> Descargar
                </a>
             </div>
             <div className="flex-1 flex items-center justify-center p-8 bg-slate-100/50">
                <iframe src={fileUrl} className="w-full h-full max-w-5xl aspect-[3/4] border border-slate-200 rounded-lg shadow-sm bg-white" title="File Viewer" />
             </div>
        </div>
      );
  }

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-800">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4 text-white shrink-0">
        <div className="flex items-center gap-2">
            {onClose && (
                <button 
                    onClick={onClose}
                    className="flex items-center text-slate-400 hover:text-white transition gap-1 text-sm font-medium mr-4"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
            )}
            
            <div className="flex items-center gap-1 bg-slate-700/50 rounded-lg p-1">
                <button onClick={() => insertText('**Bold**')} className="p-1.5 hover:bg-slate-600 rounded text-xs font-bold" title="Negrita">B</button>
                <button onClick={() => insertText('*Italic*')} className="p-1.5 hover:bg-slate-600 rounded text-xs italic" title="Cursiva">I</button>
                <button onClick={() => insertText('# ')} className="p-1.5 hover:bg-slate-600 rounded text-xs" title="Título">H1</button>
                <button onClick={() => insertText('$$ \n$$')} className="p-1.5 hover:bg-slate-600 rounded text-xs font-mono" title="LaTeX">TeX</button>
                <button onClick={() => insertText('[]()')} className="p-1.5 hover:bg-slate-600 rounded text-xs" title="Enlace">Link</button>
            </div>

            <div className="h-6 w-px bg-slate-700 mx-2"></div>
            
            <button 
                onClick={() => setShowPreview(!showPreview)}
                className={`flex items-center gap-2 text-xs px-3 py-1.5 rounded transition ${showPreview ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-700'}`}
            >
                {showPreview ? <Columns className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span className="hidden lg:inline">{showPreview ? 'Split' : 'Code'}</span>
            </button>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs text-slate-400">
                {saving ? (
                    <span className="flex items-center gap-1"><Cloud className="w-3 h-3 animate-pulse" /> Guardando...</span>
                ) : (
                    <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> Listo</span>
                )}
            </div>
            
            <button 
                onClick={() => setShowExport(true)}
                className="p-2 hover:bg-slate-700 rounded-lg text-slate-300 transition"
                title="Exportar"
            >
                <Download className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 overflow-hidden flex relative">
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

        {/* Export Modal */}
        {showExport && (
            <div className="absolute top-2 right-2 z-20 bg-slate-800 border border-slate-600 rounded-xl shadow-xl p-4 w-64 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-3">
                    <span className="text-sm font-bold text-white">Exportar Documento</span>
                    <button onClick={() => setShowExport(false)} className="text-slate-400 hover:text-white"><EyeOff className="w-4 h-4" /></button>
                </div>
                <div className="space-y-2">
                    <button onClick={() => handleExport('md')} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition flex items-center gap-2">
                        <FileIcon className="w-4 h-4" /> Markdown (.md)
                    </button>
                    <button onClick={() => window.print()} className="w-full text-left px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 rounded-lg transition flex items-center gap-2">
                        <FileIcon className="w-4 h-4" /> PDF (Imprimir)
                    </button>
                </div>
            </div>
        )}
      </div>
    </div>
  );
}
