'use client';

import dynamic from 'next/dynamic';

const Debugger = dynamic(() => import('./Debugger'), { ssr: false });

export default function DebuggerLoader() {
  return <Debugger />;
}
