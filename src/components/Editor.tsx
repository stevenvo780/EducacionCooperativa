'use client';

import React, { useEffect, useState } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { markdown, markdownLanguage } from '@codemirror/lang-markdown';
import { languages } from '@codemirror/language-data';
import io, { Socket } from 'socket.io-client';

interface EditorProps {
  initialContent?: string;
  roomId: string;
}

let socket: Socket;

export default function Editor({ initialContent = '', roomId }: EditorProps) {
  const [content, setContent] = useState(initialContent);

  useEffect(() => {
    // Initialize Socket
    socket = io();

    socket.emit('join-room', roomId);

    socket.on('code-update', (newContent: string) => {
      setContent(newContent);
    });

    return () => {
      if (socket) socket.disconnect();
    };
  }, [roomId]);

  const onChange = (val: string, viewUpdate: any) => {
    setContent(val);
    socket.emit('code-change', { roomId, content: val });
  };

  return (
    <div className="border rounded-md overflow-hidden">
      <CodeMirror
        value={content}
        height="500px"
        extensions={[markdown({ base: markdownLanguage, codeLanguages: languages })]}
        onChange={onChange}
        theme="dark"
      />
    </div>
  );
}
