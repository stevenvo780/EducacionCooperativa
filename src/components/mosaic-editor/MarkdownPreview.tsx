'use client';

import React, { useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import { AlertTriangle } from 'lucide-react';
import MermaidDiagram from '@/components/MermaidDiagram';
import {
  convertWikiLinksToMarkdown,
  isBrowserNavigationHref,
  isExternalMarkdownHref,
  unescapeLatex
} from './utils';

class DiagramErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback: string },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode; fallback: string }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mermaid-error">
          <div className="mermaid-error-label">
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Error al renderizar diagrama</span>
          </div>
          <pre className="mermaid-error-source">{this.props.fallback}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

export const MarkdownPreview = React.memo(function MarkdownPreview({
  content,
  onOpenInternalLink
}: {
  content: string;
  onOpenInternalLink?: (href: string) => Promise<boolean>;
}) {
  const processed = useMemo(
    () => convertWikiLinksToMarkdown(unescapeLatex(content)),
    [content]
  );

  return (
    <div className="markdown-preview-container overflow-auto h-full">
      <ReactMarkdown
        remarkPlugins={[remarkMath, remarkGfm]}
        rehypePlugins={[rehypeKatex]}
        components={{
          pre({ children }) {
            const child = React.Children.toArray(children)[0] as React.ReactElement;
            const className: string = (child?.props as Record<string, string>)?.className || '';
            if (/language-mermaid/.test(className)) {
              const code = String((child?.props as Record<string, unknown>)?.children || '').trim();
              return (
                <DiagramErrorBoundary fallback={code}>
                  <MermaidDiagram chart={code} />
                </DiagramErrorBoundary>
              );
            }
            return <pre>{children}</pre>;
          },
          code({ className, children, ...props }) {
            if (/language-mermaid/.test(className || '')) {
              const code = String(children).trim();
              return (
                <DiagramErrorBoundary fallback={code}>
                  <MermaidDiagram chart={code} />
                </DiagramErrorBoundary>
              );
            }
            return <code className={className} {...props}>{children}</code>;
          },
          a({ href, children, ...props }) {
            const isExternal = !href || href.startsWith('#') || isExternalMarkdownHref(href);
            return (
              <a
                href={href}
                {...props}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noreferrer noopener' : undefined}
                onClick={async (event) => {
                  props.onClick?.(event);
                  if (event.defaultPrevented || !href || !onOpenInternalLink) return;
                  if (href.startsWith('#') || isExternalMarkdownHref(href)) return;
                  event.preventDefault();
                  const opened = await onOpenInternalLink(href);
                  if (!opened && isBrowserNavigationHref(href)) {
                    window.location.assign(href);
                  }
                }}
              >
                {children}
              </a>
            );
          }
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  );
});
