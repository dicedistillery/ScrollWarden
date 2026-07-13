import React from 'react';

interface MarkdownRendererProps {
  content: string;
  isUserMessage?: boolean;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isUserMessage = false }) => {
  // Simple markdown parsing function
  const parseMarkdown = (text: string): React.ReactNode[] => {
    const lines = text.split('\n');
    const elements: React.ReactNode[] = [];
    let currentList: React.ReactNode[] = [];
    let listType: 'ul' | 'ol' | null = null;
    let inCodeBlock = false;
    let codeBlockContent: string[] = [];
    let codeBlockLanguage = '';
    
    const finishList = () => {
      if (currentList.length > 0 && listType) {
        const ListTag = listType;
        elements.push(
          <ListTag key={`list-${elements.length}`} className="ml-4 mb-2 space-y-1">
            {currentList}
          </ListTag>
        );
        currentList = [];
        listType = null;
      }
    };

    const finishCodeBlock = () => {
      if (codeBlockContent.length > 0) {
        elements.push(
          <pre key={`code-${elements.length}`} className={`
            ${isUserMessage ? 'bg-blue-600 bg-opacity-20' : 'bg-gray-100'} 
            rounded p-3 mb-2 overflow-x-auto text-sm font-mono
          `}>
            <code className={codeBlockLanguage ? `language-${codeBlockLanguage}` : ''}>
              {codeBlockContent.join('\n')}
            </code>
          </pre>
        );
        codeBlockContent = [];
        codeBlockLanguage = '';
      }
      inCodeBlock = false;
    };

    lines.forEach((line, index) => {
      // Handle code blocks
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          finishCodeBlock();
        } else {
          finishList();
          inCodeBlock = true;
          codeBlockLanguage = line.slice(3).trim();
        }
        return;
      }

      if (inCodeBlock) {
        codeBlockContent.push(line);
        return;
      }

      // Handle headers
      if (line.startsWith('# ')) {
        finishList();
        elements.push(
          <h1 key={`h1-${index}`} className="text-lg font-bold mb-2 mt-3 first:mt-0">
            {parseInlineMarkdown(line.slice(2))}
          </h1>
        );
        return;
      }

      if (line.startsWith('## ')) {
        finishList();
        elements.push(
          <h2 key={`h2-${index}`} className="text-base font-bold mb-2 mt-2 first:mt-0">
            {parseInlineMarkdown(line.slice(3))}
          </h2>
        );
        return;
      }

      if (line.startsWith('### ')) {
        finishList();
        elements.push(
          <h3 key={`h3-${index}`} className="text-sm font-bold mb-1 mt-2 first:mt-0">
            {parseInlineMarkdown(line.slice(4))}
          </h3>
        );
        return;
      }

      // Handle unordered lists
      if (line.match(/^[-*+]\s/)) {
        if (listType !== 'ul') {
          finishList();
          listType = 'ul';
        }
        currentList.push(
          <li key={`li-${index}`} className="text-sm">
            {parseInlineMarkdown(line.replace(/^[-*+]\s/, ''))}
          </li>
        );
        return;
      }

      // Handle ordered lists
      if (line.match(/^\d+\.\s/)) {
        if (listType !== 'ol') {
          finishList();
          listType = 'ol';
        }
        currentList.push(
          <li key={`li-${index}`} className="text-sm">
            {parseInlineMarkdown(line.replace(/^\d+\.\s/, ''))}
          </li>
        );
        return;
      }

      // Handle inline code
      if (line.includes('`') && !line.startsWith('```')) {
        finishList();
        elements.push(
          <p key={`p-${index}`} className="text-sm leading-relaxed mb-2">
            {parseInlineMarkdown(line)}
          </p>
        );
        return;
      }

      // Handle regular paragraphs
      if (line.trim()) {
        finishList();
        elements.push(
          <p key={`p-${index}`} className="text-sm leading-relaxed mb-2">
            {parseInlineMarkdown(line)}
          </p>
        );
      } else if (elements.length > 0) {
        // Empty line - add spacing
        elements.push(<div key={`space-${index}`} className="h-2" />);
      }
    });

    // Finish any remaining list or code block
    finishList();
    if (inCodeBlock) {
      finishCodeBlock();
    }

    return elements;
  };

  // Parse inline markdown (bold, italic, code, links)
  const parseInlineMarkdown = (text: string): React.ReactNode[] => {
    const parts: React.ReactNode[] = [];
    let currentIndex = 0;
    
    // Patterns for inline formatting
    const patterns = [
      { regex: /\*\*(.*?)\*\*/g, component: (match: string, content: string, key: number) => 
        <strong key={key} className="font-semibold">{content}</strong> },
      { regex: /\*(.*?)\*/g, component: (match: string, content: string, key: number) => 
        <em key={key} className="italic">{content}</em> },
      { regex: /`([^`]+)`/g, component: (match: string, content: string, key: number) => 
        <code key={key} className={`
          ${isUserMessage ? 'bg-blue-600 bg-opacity-30' : 'bg-gray-200'} 
          px-1 py-0.5 rounded text-xs font-mono
        `}>{content}</code> },
      { regex: /\[([^\]]+)\]\(([^)]+)\)/g, component: (match: string, content: string, key: number, url?: string) => 
        <a key={key} href={url} target="_blank" rel="noopener noreferrer" 
           className={`${isUserMessage ? 'text-blue-100 underline' : 'text-blue-600 underline'} hover:opacity-80`}>
          {content}
        </a> }
    ];

    let remainingText = text;
    let keyCounter = 0;

    while (remainingText.length > 0) {
      type InlineMatch = { index: number; length: number; element: React.ReactNode };
      let earliestMatch: InlineMatch | null = null;

      // Find the earliest match among all patterns
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0; // Reset regex
        const match = pattern.regex.exec(remainingText);
        if (match && (earliestMatch === null || match.index < earliestMatch.index)) {
          const element = pattern.component(
            match[0],
            match[1],
            keyCounter++,
            match[2] // For links, this will be the URL
          );
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            element
          };
        }
      }

      const matchToRender = earliestMatch;
      if (matchToRender) {
        // Add text before the match
        if (matchToRender.index > 0) {
          parts.push(remainingText.substring(0, matchToRender.index));
        }
        
        // Add the formatted element
        parts.push(matchToRender.element);
        
        // Continue with text after the match
        remainingText = remainingText.substring(matchToRender.index + matchToRender.length);
      } else {
        // No more matches, add remaining text
        parts.push(remainingText);
        break;
      }
    }

    return parts;
  };

  return <div className="markdown-content">{parseMarkdown(content)}</div>;
};

export default MarkdownRenderer;