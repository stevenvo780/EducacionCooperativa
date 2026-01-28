'use client';

import React, { useEffect, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { ChevronLeft, Cloud, Check } from 'lucide-react';
import Link from 'next/link';

interface EditorProps {
  initialContent?: string;
  roomId: string; 
}

export default function Editor({ initialContent = '', roomId }: EditorProps) {
  const [content, setContent] = useState(initialContent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!roomId) return;
    const docRef = doc(db, 'documents', roomId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.content !== undefined && data.lastUpdatedBy !== auth.currentUser?.uid) {
           setContent(data.content);
        }
      } else {
        setDoc(docRef, { 
            content: initialContent, 
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

  return (
    <div className="flex flex-col h-screen bg-slate-900">
      {/* Toolbar */}
      <div className="h-14 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4 text-white">
        <Link 
            href="/dashboard"
            className="flex items-center text-slate-400 hover:text-white transition gap-1 text-sm font-medium"
        >
            <ChevronLeft className="w-4 h-4" />
            Volver
        </Link>
        
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
      <div className="flex-1 overflow-auto">
        <CodeMirror
            value={content}
            height="100%"
            extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
            onChange={onChange}
            theme="dark" 
            className="text-base"
        />
      </div>
    </div>
  );
}
