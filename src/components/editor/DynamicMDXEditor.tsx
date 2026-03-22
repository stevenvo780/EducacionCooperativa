'use client';

import dynamic from 'next/dynamic';
import React, { forwardRef } from 'react';
import type { MDXEditorProps, MDXEditorMethods } from '@mdxeditor/editor';

const MDXEditor = dynamic(
  () => import('@mdxeditor/editor').then((mod) => mod.MDXEditor),
  { ssr: false }
);

export const DynamicMDXEditor = forwardRef<MDXEditorMethods, MDXEditorProps>((props, ref) => {
  return <MDXEditor {...props} ref={ref} />;
});

DynamicMDXEditor.displayName = 'DynamicMDXEditor';
