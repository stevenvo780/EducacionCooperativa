'use client';

import React, { useEffect, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';

interface EditorProps {
  initialContent?: string;
  roomId: string; // This corresponds to the Firestore document ID
}

export default function Editor({ initialContent = '', roomId }: EditorProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    if (!roomId) return;

    // Listen to document changes in Firestore
    const docRef = doc(db, 'documents', roomId);
    
    // Subscribe to realtime updates
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.content !== undefined && data.lastUpdatedBy !== auth.currentUser?.uid) {
           // Only update local state if the change came from someone else
           // to avoid cursor jumping or loops (basic implementation)
           setContent(data.content);
        }
      } else {
        // Create doc if it doesn't exist
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
    
    if (!roomId) return;
    
    const docRef = doc(db, 'documents', roomId);
    try {
        // Debouncing would be good here for production to save writes
        await setDoc(docRef, { 
            content: val, 
            updatedAt: serverTimestamp(),
            lastUpdatedBy: auth.currentUser?.uid 
        }, { merge: true });
    } catch (e) {
        console.error("Error updating document:", e);
    }
  }, [roomId]);

  return (
    <div className="border rounded-md overflow-hidden">
      <CodeMirror
        value={content}
        height="calc(100vh - 100px)"
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
        onChange={onChange}
        theme="dark"
      />
    </div>
  );
}
