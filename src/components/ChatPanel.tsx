import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChatMessage, Citation, OnChatSubmit, OnCitationClick } from '../types/index.ts';
import AIProviderSelector from './AIProviderSelector.tsx';
import MarkdownRenderer from './MarkdownRenderer.tsx';

interface ChatPanelProps {
  messages: ChatMessage[];
  isAiThinking: boolean;
  canSubmit: boolean;
  onSubmit: OnChatSubmit;
  onCitationClick: OnCitationClick;
}

interface MessageBubbleProps {
  message: ChatMessage;
  onCitationClick: OnCitationClick;
}

const MessageBubble: React.FC<MessageBubbleProps> = ({ message, onCitationClick }) => {
  const isUser = message.type === 'user';

  const handleCitationClick = (citation: Citation) => {
    onCitationClick(citation);
  };

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-3`}>
      <div className={`max-w-[85%] w-full`}>
        <div
          className={`
            px-4 py-3 shadow-sm transition-all duration-300
            ${isUser
              ? 'bg-primary-600 text-white rounded-2xl rounded-br-sm ml-auto shadow-primary-500/20'
              : 'bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm mr-auto shadow-slate-200/50'
            }
          `}
        >
          {isUser ? (
            <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
          ) : (
            <MarkdownRenderer content={message.content} isUserMessage={false} />
          )}

          {message.citation && (
            <div className={`mt-3 pt-3 border-t ${isUser ? 'border-primary-400/50' : 'border-slate-100'}`}>
              <button
                onClick={() => {
                  console.log(`Citation clicked: ${message.citation!.documentName}, Page ${message.citation!.pageNumber}`);
                  handleCitationClick(message.citation!);
                }}
                className={`citation-button inline-flex items-center px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer transform hover:scale-[1.02] active:scale-[0.98] ${isUser
                    ? 'bg-white/20 hover:bg-white/30 text-white'
                    : 'bg-primary-50 text-primary-700 hover:bg-primary-100'
                  }`}
                title="Click to navigate to this page in the PDF"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                📍 {message.citation.documentName}, Page {message.citation.pageNumber}
              </button>
            </div>
          )}
        </div>

        <div className={`text-xs text-gray-500 mt-1 ${isUser ? 'text-right' : 'text-left'}`}>
          {formatTimestamp(message.timestamp)}
        </div>
      </div>
    </div>
  );
};

const ThinkingIndicator: React.FC = () => {
  return (
    <div className="flex justify-start mb-3">
      <div className="max-w-[85%]">
        <div className="bg-white border border-slate-200 text-slate-800 rounded-2xl rounded-bl-sm px-4 py-3 shadow-sm shadow-slate-200/50 mr-auto">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1.5 shrink-0">
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-primary-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <span className="text-sm font-medium text-slate-500">AI is thinking</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ChatPanel: React.FC<ChatPanelProps> = ({
  messages,
  isAiThinking,
  canSubmit,
  onSubmit,
  onCitationClick
}) => {
  const [inputValue, setInputValue] = useState('');
  const [isComposing, setIsComposing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isAiThinking]);

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    }
  }, [inputValue]);

  const handleSubmit = useCallback(() => {
    if (!inputValue.trim() || !canSubmit || isAiThinking) return;

    onSubmit(inputValue);
    setInputValue('');
  }, [inputValue, canSubmit, isAiThinking, onSubmit]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey && !isComposing) {
      event.preventDefault();
      handleSubmit();
    }
  }, [handleSubmit, isComposing]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(event.target.value);
  }, []);

  const isInputDisabled = !canSubmit || isAiThinking;

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200/60 bg-white/50 backdrop-blur-sm z-10 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-primary-500 to-indigo-400 flex items-center justify-center text-white shadow-sm shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800">AI Assistant</h3>
          <div className="ml-2">
            <AIProviderSelector />
          </div>
        </div>
        <div className="flex items-center space-x-2 bg-slate-50 px-2.5 py-1 rounded-full border border-slate-100">
          <div className={`
            w-2 h-2 rounded-full
            ${isAiThinking ? 'bg-amber-400 animate-pulse' : canSubmit ? 'bg-emerald-400' : 'bg-slate-300'}
          `}></div>
          <span className="text-xs text-slate-600 font-medium">
            {isAiThinking ? 'Processing...' : canSubmit ? 'Ready' : 'No PDFs'}
          </span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-0">
        {messages.length === 0 && !isAiThinking ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6 animate-fade-in">
            <div className="w-16 h-16 bg-primary-50 rounded-2xl flex items-center justify-center mb-5 shadow-sm border border-primary-100">
              <svg className="w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <p className="text-xl font-semibold text-slate-800 mb-2">How can I help you today?</p>
            <p className="text-sm text-slate-500 max-w-xs leading-relaxed">
              Ask me any question about your uploaded documents, and I'll find the answers for you.
            </p>
            {!canSubmit && (
              <div className="mt-6 p-4 bg-amber-50 border border-amber-200/60 rounded-xl shadow-sm">
                <p className="text-sm font-medium text-amber-800">
                  Upload and process PDFs to get started.
                </p>
              </div>
            )}
          </div>
        ) : (
          <>
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                onCitationClick={onCitationClick}
              />
            ))}

            {isAiThinking && <ThinkingIndicator />}
          </>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-200/60 p-4 bg-white/50 backdrop-blur-sm shrink-0">
        <div className="relative flex items-end shadow-sm bg-white border border-slate-300 focus-within:ring-2 focus-within:ring-primary-500/20 focus-within:border-primary-400 rounded-2xl transition-all duration-300">
          <textarea
            ref={textareaRef}
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={() => setIsComposing(false)}
            placeholder={
              !canSubmit
                ? "Upload a PDF to start asking questions..."
                : isAiThinking
                  ? "AI is processing your request..."
                  : "Ask a question about your PDFs..."
            }
            disabled={isInputDisabled}
            className={`
              w-full px-4 py-3.5 bg-transparent border-none resize-none outline-none
              disabled:opacity-60 disabled:cursor-not-allowed
              placeholder:text-slate-400 text-slate-700
              min-h-[3rem] max-h-[10rem] rounded-2xl
            `}
            rows={1}
            style={{ lineHeight: '1.5' }}
          />

          <div className="p-2 shrink-0">
            <button
              onClick={handleSubmit}
              disabled={!inputValue.trim() || isInputDisabled}
              className={`
                flex items-center justify-center w-10 h-10 rounded-xl transition-all duration-300
                ${(!inputValue.trim() || isInputDisabled)
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  : 'bg-primary-600 text-white hover:bg-primary-700 hover:shadow-md hover:shadow-primary-500/20 active:scale-95'
                }
              `}
              title={
                !canSubmit
                  ? "Upload and process PDFs first"
                  : isAiThinking
                    ? "Please wait for AI response"
                    : "Send message"
              }
            >
              <svg className="w-5 h-5 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>

        <div className="mt-2.5 text-xs text-center text-slate-400">
          {canSubmit && !isAiThinking ? (
            <span>💡 I'll search through your PDFs and provide answers with page citations</span>
          ) : (
            <span className="invisible">Space</span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;