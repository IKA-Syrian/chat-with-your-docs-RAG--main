import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export default function MarkdownMessage({ content, className = '' }: MarkdownMessageProps) {
  const components: Components = {
    // Customize headings
    h1: ({ children }) => <h1 className="text-lg font-bold mb-2 mt-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-bold mb-2 mt-2">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-bold mb-1 mt-1">{children}</h3>,
    
    // Customize paragraphs
    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    
    // Customize lists
    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
    
    // Customize code blocks
    code: ({ children, ...props }) => {
      const isInline = !props.className;
      if (isInline) {
        return (
          <code className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono" {...props}>
            {children}
          </code>
        );
      }
      return (
        <pre className="bg-gray-100 p-3 rounded overflow-x-auto mb-2 text-xs">
          <code className="font-mono" {...props}>
            {children}
          </code>
        </pre>
      );
    },
    
    // Customize blockquotes
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 pl-3 italic mb-2 text-gray-700">
        {children}
      </blockquote>
    ),
    
    // Customize tables
    table: ({ children }) => (
      <div className="overflow-x-auto mb-2">
        <table className="min-w-full border border-gray-300 text-xs">
          {children}
        </table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-gray-300 px-2 py-1 bg-gray-100 font-semibold text-left">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-gray-300 px-2 py-1">
        {children}
      </td>
    ),
    
    // Customize links
    a: ({ children, href }) => (
      <a 
        href={href} 
        className="text-blue-600 hover:underline" 
        target="_blank" 
        rel="noopener noreferrer"
      >
        {children}
      </a>
    ),
    
    // Customize strong/bold
    strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
    
    // Customize emphasis/italic
    em: ({ children }) => <em className="italic">{children}</em>,
    
    // Customize horizontal rules
    hr: () => <hr className="my-4 border-gray-300" />,
  };

  return (
    <div className={`prose prose-sm max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:mb-2 prose-ul:mb-2 prose-ol:mb-2 prose-li:my-0 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 
 