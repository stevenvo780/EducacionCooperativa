'use client';

import dynamic from 'next/dynamic';
import React, { forwardRef } from 'react';
import type { MDXEditorProps, MDXEditorMethods } from '@mdxeditor/editor';
import { Loader2 } from 'lucide-react';

const MDXEditorSkeleton = () => (
  <div className="flex h-full w-full flex-col p-6 space-y-4 animate-pulse bg-slate-950/40">
    <div className="h-8 w-3/4 rounded-md bg-slate-800/80" />
    <div className="h-4 w-full rounded-md bg-slate-800/50 mt-6" />
    <div className="h-4 w-5/6 rounded-md bg-slate-800/50" />
    <div className="h-4 w-full rounded-md bg-slate-800/50" />
    <div className="h-4 w-4/6 rounded-md bg-slate-800/50" />
    <div className="h-4 w-full rounded-md bg-slate-800/50 mt-4" />
    <div className="h-4 w-3/4 rounded-md bg-slate-800/50" />
    <div className="flex-1" />
    <div className="flex items-center gap-2 justify-center pb-4 text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin text-blue-500/50" />
      <span className="text-xs">Inicializando motor interactivo...</span>
    </div>
  </div>
);

const MDXEditor = dynamic(
  () => import('@mdxeditor/editor').then((mod) => mod.MDXEditor),
  { ssr: false, loading: () => <MDXEditorSkeleton /> }
);

export const DynamicMDXEditor = forwardRef<MDXEditorMethods, MDXEditorProps>((props, ref) => {
  return <MDXEditor {...props} ref={ref} />;
});

DynamicMDXEditor.displayName = 'DynamicMDXEditor';
