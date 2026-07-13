// Core application types

export interface PDFFile {
  id: string;
  name: string;
  file: File;
  pages: number;
  extractedText: string;
  isProcessing: boolean;
  error?: string;
}

export interface ChatMessage {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  citation?: Citation;
}

export interface Citation {
  documentName: string;
  pageNumber: number;
}

export interface AppState {
  pdfFiles: PDFFile[];
  activePdfId: string | null;
  chatHistory: ChatMessage[];
  isAiThinking: boolean;
  sidebarCollapsed: boolean;
  sidebarWidth: number;
  chatWidth: number;
  error: string | null;
}

export interface PDFViewerState {
  scale: number;
  currentPage: number;
  totalPages: number;
  pagesRendered: Set<number>;
  scrollToPage?: number;
}

export interface AIResponse {
  content: string;
  citation?: Citation;
}

// AI Provider types
export type AIProviderType = 'openai' | 'gemini';

export interface AIProviderConfig {
  name: string;
  apiUrl: string;
  model: string;
  maxTokens: number;
  temperature: number;
}

export interface AIProvider {
  type: AIProviderType;
  config: AIProviderConfig;
  callAPI: (question: string, pdfFiles: PDFFile[], apiKey: string) => Promise<AIResponse>;
}

// PDF.js types (minimal declarations)
declare global {
  interface Window {
    pdfjsLib: {
      getDocument: (src: string | Uint8Array) => PDFLoadingTask;
      GlobalWorkerOptions: {
        workerSrc: string;
      };
    };
  }
}

export interface PDFLoadingTask {
  promise: Promise<PDFDocumentProxy>;
  destroy?: () => Promise<void>;
}

export interface PDFDocumentProxy {
  numPages: number;
  getPage: (pageNumber: number) => Promise<PDFPageProxy>;
  cleanup: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface PDFPageProxy {
  getViewport: (params: { scale: number }) => PDFPageViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    viewport: PDFPageViewport;
  }) => PDFRenderTask;
  getTextContent: () => Promise<{ items: Array<{ str: string }> }>;
}

export interface PDFRenderTask {
  promise: Promise<void>;
  cancel: () => void;
}

export interface PDFPageViewport {
  width: number;
  height: number;
  transform: number[];
}

// Event handlers and callbacks
export type OnPDFUpload = (files: FileList) => void;
export type OnChatSubmit = (message: string) => void;
export type OnCitationClick = (citation: Citation) => void;
export type OnPDFSelect = (pdfId: string) => void;
export type OnPDFRemove = (pdfId: string) => void;
export type OnClearAllPDFs = () => void;
export type OnSidebarResize = (width: number) => void;
export type OnSidebarToggle = () => void;
