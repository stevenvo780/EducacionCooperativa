'use client';

import React, { useEffect, useState, useCallback } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import { db } from '@/lib/firebase';
import { useAuth } from '@/context/AuthContext';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  ChevronLeft, Cloud, Check, Download, 
  Maximize2, Minimize2, PanelLeftClose, PanelRightClose,
  Bold, Italic, Heading, Link as LinkIcon, Code, Columns,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Group, Panel, Separator } from "react-resizable-panels";
import clsx from 'clsx';
import 'katex/dist/katex.min.css';

interface EditorProps {
  initialContent?: string;
  roomId: string; 
  onClose?: () => void;
}

export default function Editor({ initialContent = '', roomId, onClose }: EditorProps) {
  const { user } = useAuth();
  const [content, setContent] = useState(initialContent);
  const [docType, setDocType] = useState<'text' | 'file'>('text');
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Layout States
  const [showPreview, setShowPreview] = useState(true);
  const [showToolbar, setShowToolbar] = useState(true);
  const [showFooter, setShowFooter] = useState(true);
  
  useEffect(() => {
    if (!roomId) return;
    
    // Server-side fetch fallback
    const fetchDoc = async () => {
        try {
            const res = await fetch(`/api/documents/${roomId}`);
            if (res.ok) {
                const data = await res.json();
                if (data.type === 'file') {
                    setDocType('file');
                    setFileUrl(data.url);
                    setContent(data.name || 'File');
                } else {
                    if (data.content !== undefined) {
                        setContent(data.content);
                    }
                }
            } else if (res.status === 404) {
                 // Initialize with default
                 setContent(initialContent);
            }
        } catch (e) {
            console.error("Error fetching document:", e);
        }
    };
    
    fetchDoc();
    // Disable onSnapshot for now as it causes permission errors
    /*
    const docRef = doc(db, 'documents', roomId);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.type === 'file') {
            setDocType('file');
            setFileUrl(data.url);
            setContent(data.name || 'File');
        } else {
            if (data.content !== undefined && data.lastUpdatedBy !== user?.uid) {
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
    */
  }, [roomId, initialContent]);

  // Debouncing logic
  const saveTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);

  const onChange = useCallback((val: string) => {
    setContent(val);
    setSaving(true);
    
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    
    saveTimeoutRef.current = setTimeout(async () => {
        if (!roomId) return;
        try {
            const res = await fetch(`/api/documents/${roomId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                   content: val,
                   lastUpdatedBy: user?.uid 
                })
            });
            if (!res.ok) throw new Error("Failed to save");
        } catch (e) {
            console.error("Error updating document:", e);
        } finally {
            setSaving(false); 
        }
    }, 1000);
  }, [roomId, user]);

  const insertText = (template: string, cursorOffset = 0) => {
      const newVal = content + template;
      onChange(newVal);
  };

  const handleExport = () => {
      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `document_${roomId}.md`;
      a.click();
  };

  // --- File Viewer Mode ---
  if (docType === 'file' && fileUrl) {
      return (
        <div className="flex flex-col h-full bg-slate-900 text-white">
             <div className="h-14 border-b border-slate-700 bg-slate-800 flex items-center justify-between px-4">
                <button onClick={onClose} className="flex items-center text-slate-400 hover:text-white gap-2 font-medium">
                    <ChevronLeft className="w-5 h-5" /> Back
                </button>
                <div className="font-bold truncate px-4">{content}</div>
                <a href={fileUrl} target="_blank" rel="noreferrer" className="bg-blue-600 px-4 py-2 rounded hover:bg-blue-500 flex items-center gap-2">
                    <Download className="w-4 h-4" /> Download
                </a>
             </div>
             <div className="flex-1 p-4 bg-slate-950 flex items-center justify-center">
                <iframe src={fileUrl} className="w-full h-full border-none bg-white rounded" />
             </div>
        </div>
      );
  }

  // --- Markdown Editor Mode ---
  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-300 relative overflow-hidden group">
      
      {/* Floating Toggles (Visible on hover/interaction) */}
      <div className={clsx(
          "absolute top-2 right-4 z-50 flex gap-2 transition-opacity duration-300",
          showToolbar ? "opacity-0 pointer-events-none" : "opacity-100"
      )}>
        <button onClick={() => setShowToolbar(true)} className="p-2 bg-slate-800/80 backdrop-blur rounded-full hover:bg-slate-700 text-slate-400 hover:text-white shadow-lg border border-slate-700">
            <Maximize2 className="w-4 h-4" />
        </button>
      </div>

      {/* --- Top Toolbar --- */}
      {showToolbar && (
        <div className="shrink-0 h-14 bg-slate-900 border-b border-slate-800 flex items-center justify-between px-3 transition-all duration-300">
            <div className="flex items-center gap-3">
                {onClose && (
                    <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white">
                        <ChevronLeft className="w-5 h-5" />
                    </button>
                )}
                <div className="h-6 w-px bg-slate-800 mx-1" />
                
                {/* Formatting Tools */}
                <div className="flex items-center gap-1">
                    <button onClick={() => insertText('**bold**')} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Bold"><Bold className="w-4 h-4" /></button>
                    <button onClick={() => insertText('*italic*')} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Italic"><Italic className="w-4 h-4" /></button>
                    <button onClick={() => insertText('# ')} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Heading"><Heading className="w-4 h-4" /></button>
                    <button onClick={() => insertText('`code`')} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Code"><Code className="w-4 h-4" /></button>
                    <button onClick={() => insertText('[title](url)')} className="p-2 hover:bg-slate-800 rounded text-slate-400 hover:text-white" title="Link"><LinkIcon className="w-4 h-4" /></button>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <button 
                    onClick={() => setShowPreview(!showPreview)} 
                    className={clsx("p-2 rounded-lg flex items-center gap-2 text-sm", showPreview ? "bg-blue-500/10 text-blue-400" : "hover:bg-slate-800 text-slate-400")}
                    title={showPreview ? "Hide Preview" : "Show Preview"}
                >
                    <Columns className="w-4 h-4" />
                    <span className="hidden sm:inline">Preview</span>
                </button>
                
                <button 
                    onClick={handleExport}
                    className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white"
                    title="Export Markdown"
                >
                    <Download className="w-4 h-4" />
                </button>

                <div className="h-6 w-px bg-slate-800 mx-1" />
                
                <button onClick={() => setShowToolbar(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white" title="Compact Mode">
                    <Minimize2 className="w-4 h-4" />
                </button>
            </div>
        </div>
      )}

      {/* --- Main Workspace (Resizable) --- */}
      <div className="flex-1 overflow-hidden relative">
          <Group orientation="horizontal">
            
            {/* Editor Panel */}
            <Panel defaultSize={50} minSize={20} className="h-full bg-slate-950">
                <div className="h-full overflow-auto custom-scrollbar">
                    <CodeMirror
                        value={content}
                        height="100%"
                        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
                        onChange={onChange}
                        theme="dark"
                        className="text-base h-full"
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: true,
                            autocompletion: true,
                        }}
                    />
                </div>
            </Panel>

            {/* Separator / Handle */}
            {showPreview && (
                <Separator className="w-2 bg-slate-800 hover:bg-blue-600 transition-colors flex items-center justify-center z-10 cursor-col-resize" />
            )}

            {/* Preview Panel */}
            {showPreview && (
                <Panel defaultSize={50} minSize={20} className="h-full bg-slate-900">
                    <div className="h-full overflow-auto p-8 custom-scrollbar">
                        <article className="prose prose-invert prose-slate max-w-none prose-headings:font-bold prose-a:text-blue-400 hover:prose-a:text-blue-300">
                            <ReactMarkdown 
                                remarkPlugins={[remarkMath]} 
                                rehypePlugins={[rehypeKatex]}
                            >
                                {content}
                            </ReactMarkdown>
                        </article>
                    </div>
                </Panel>
            )}

          </Group>
      </div>

      {/* --- Bottom Status Bar --- */}
      {showFooter && (
        <div className="shrink-0 h-8 bg-slate-900 border-t border-slate-800 flex items-center justify-between px-4 text-xs select-none">
            <div className="flex items-center gap-4 text-slate-500">
                <span>Markdown</span>
                <span>{content.length} chars</span>
            </div>
            <div className="flex items-center gap-3">
                {saving ? (
                    <span className="flex items-center gap-1 text-blue-400"><Cloud className="w-3 h-3 animate-pulse" /> Saving...</span>
                ) : (
                    <span className="flex items-center gap-1 text-emerald-400"><Check className="w-3 h-3" /> Saved</span>
                )}
                <button onClick={() => setShowFooter(false)} className="hover:text-white"><PanelRightClose className="w-3 h-3" /></button>
            </div>
        </div>
      )}
      
      {/* Footer Toggle (if hidden) */}
      {!showFooter && (
          <button 
            onClick={() => setShowFooter(true)} 
            className="absolute bottom-2 right-4 p-1.5 bg-slate-800/80 backdrop-blur rounded-full text-slate-400 hover:text-white border border-slate-700 z-50"
          >
              <PanelLeftClose className="w-3 h-3 rotate-180" />
          </button>
      )}

      <style jsx global>{`
        .cm-editor { height: 100%; font-family: 'Fira Code', monospace; }
        .cm-scroller { overflow: auto !important; }
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { bg: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background-color: #334155; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background-color: #475569; }
      `}</style>
    </div>
  );
}