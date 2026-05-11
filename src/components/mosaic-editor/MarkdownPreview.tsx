'use client';

import React, { useEffect, useMemo, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeRaw from 'rehype-raw';
import remarkGfm from 'remark-gfm';
import { AlertTriangle } from 'lucide-react';
import type { PluggableList } from 'unified';
import MermaidDiagram from '@/components/MermaidDiagram';
import {
  convertWikiLinksToMarkdown,
  hasKatexContent,
  isBrowserNavigationHref,
  isExternalMarkdownHref,
  unescapeLatex
} from './utils';

type RemarkMathModule = typeof import('remark-math');
type RehypeKatexModule = typeof import('rehype-katex');

let mathPluginsPromise: Promise<{ remarkMath: RemarkMathModule['default']; rehypeKatex: RehypeKatexModule['default'] }> | null = null;
let cachedMathPlugins: { remarkMath: RemarkMathModule['default']; rehypeKatex: RehypeKatexModule['default'] } | null = null;

const loadMathPlugins = async (): Promise<{ remarkMath: RemarkMathModule['default']; rehypeKatex: RehypeKatexModule['default'] }> => {
  if (cachedMathPlugins) return cachedMathPlugins;
  if (!mathPluginsPromise) {
    mathPluginsPromise = Promise.all([
      import('remark-math'),
      import('rehype-katex')
    ]).then(([rm, rk]) => {
      cachedMathPlugins = {
        remarkMath: rm.default,
        rehypeKatex: rk.default
      };
      return cachedMathPlugins;
    });
  }
  return mathPluginsPromise;
};

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

/**
 * Heuristic: detect whether a plain-text code block looks like an ASCII-art
 * diagram (box-drawing characters, arrows, alignment pipes, etc.)
 */
const looksLikeAsciiDiagram = (text: string): boolean => {
  const diagramChars = /[┌┐└┘├┤┬┴┼─│╔╗╚╝║═╠╣╦╩╬→←↑↓↔⇒⇐⇑⇓⇔|\\\/\+\-]{3,}/;
  const boxLine = /^[\s]*[\+\-\|\\\/\[\]]{2,}/m;
  const arrowLine = /(\-\->|<\-\-|\->|<\-|=>|==>|<==|\|>|<\||\\\/|\/\\)/;
  const pipeStructure = /^\s*\|.*\|/m;
  const multiLinePipes = (text.match(/^\s*[\|\\\/]/gm) || []).length >= 3;
  return diagramChars.test(text) || boxLine.test(text) || arrowLine.test(text) || (pipeStructure.test(text) && multiLinePipes);
};

/**
 * Extract plain text from React children (handles nested elements).
 */
const extractTextFromChildren = (children: React.ReactNode): string => {
  if (typeof children === 'string') return children;
  if (typeof children === 'number') return String(children);
  if (Array.isArray(children)) return children.map(extractTextFromChildren).join('');
  if (React.isValidElement(children)) {
    const props = children.props as Record<string, unknown>;
    return extractTextFromChildren(props.children as React.ReactNode);
  }
  return '';
};

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

  const needsMath = useMemo(() => hasKatexContent(processed), [processed]);
  const [mathPlugins, setMathPlugins] = useState<{ remarkMath: RemarkMathModule['default']; rehypeKatex: RehypeKatexModule['default'] } | null>(cachedMathPlugins);

  useEffect(() => {
    if (!needsMath) return;
    if (mathPlugins) return;
    let cancelled = false;
    void loadMathPlugins().then((plugins) => {
      if (!cancelled) setMathPlugins(plugins);
    });
    return () => {
      cancelled = true;
    };
  }, [needsMath, mathPlugins]);

  const remarkPlugins = useMemo<PluggableList>(() => {
    if (needsMath && mathPlugins) return [mathPlugins.remarkMath, remarkGfm];
    return [remarkGfm];
  }, [needsMath, mathPlugins]);

  const rehypePlugins = useMemo<PluggableList>(() => {
    if (needsMath && mathPlugins) return [rehypeRaw, mathPlugins.rehypeKatex];
    return [rehypeRaw];
  }, [needsMath, mathPlugins]);

  return (
    <div className="markdown-preview-container overflow-auto h-full">
      <ReactMarkdown
        remarkPlugins={remarkPlugins}
        rehypePlugins={rehypePlugins}
        components={{
          pre({ children }) {
            const childArray = React.Children.toArray(children);
            const child = childArray[0] as React.ReactElement | undefined;
            if (!child) return <pre>{children}</pre>;

            const childProps = (child.props ?? {}) as Record<string, unknown>;
            const className: string = String(childProps.className || '');
            const code = extractTextFromChildren(childProps.children as React.ReactNode).trim();

            if (/language-mermaid/.test(className)) {
              return (
                <DiagramErrorBoundary fallback={code}>
                  <MermaidDiagram chart={code} />
                </DiagramErrorBoundary>
              );
            }

            const hasNoLang = !className || className === 'language-' || className === 'language-text';
            if (hasNoLang && code && looksLikeAsciiDiagram(code)) {
              return (
                <pre className="ascii-diagram-block">
                  <code>{code}</code>
                </pre>
              );
            }

            return <pre className={className}>{children}</pre>;
          },
          code({ className, children, ...props }) {
            if (/language-mermaid/.test(className || '')) {
              const code = extractTextFromChildren(children).trim();
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
