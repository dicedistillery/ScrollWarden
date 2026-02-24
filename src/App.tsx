import React, { useState, useCallback, useRef } from 'react';
import { 
  PDFFile, 
  ChatMessage, 
  Citation, 
  AppState, 
  OnPDFUpload, 
  OnChatSubmit, 
  OnCitationClick, 
  OnPDFSelect,
  OnPDFRemove,
  OnClearAllPDFs,
  OnSidebarResize,
  OnSidebarToggle 
} from './types/index.ts';
import { PDFManagerSidebar } from './components/PDFManagerSidebar.tsx';
import { PDFViewer } from './components/PDFViewer.tsx';
import { ChatPanel } from './components/ChatPanel.tsx';
import { WelcomeScreen } from './components/WelcomeScreen.tsx';
import { processPDFFile } from './services/pdfProcessor.ts';
import { queryAI } from './services/aiService.ts';

const INITIAL_SIDEBAR_WIDTH = 320;
const INITIAL_CHAT_WIDTH = 384; // w-96 equivalent
const MIN_CHAT_WIDTH = 384;
const MAX_CHAT_WIDTH = 768; // Double the initial size

export const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>({
    pdfFiles: [],
    activePdfId: null,
    chatHistory: [],
    isAiThinking: false,
    sidebarCollapsed: false,
    sidebarWidth: INITIAL_SIDEBAR_WIDTH,
    chatWidth: INITIAL_CHAT_WIDTH,
    error: null
  });

  const nextMessageId = useRef(1);
  const nextPdfId = useRef(1);

  const generateMessageId = (): string => {
    return `msg_${nextMessageId.current++}`;
  };

  const generatePdfId = (): string => {
    return `pdf_${nextPdfId.current++}`;
  };

  // Handle PDF file uploads
  const handlePDFUpload: OnPDFUpload = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    
    // Validate file size (max 80MB per file)
    const MAX_FILE_SIZE = 80 * 1024 * 1024; // 80MB
    const MAX_TOTAL_FILES = 10;
    
    const oversizedFiles = fileArray.filter(file => file.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setAppState(prev => ({
        ...prev,
        error: `Some files exceed the 80MB limit: ${oversizedFiles.map(f => f.name).join(', ')}`
      }));
      return;
    }
    
    // Check total file limit
    if (appState.pdfFiles.length + fileArray.length > MAX_TOTAL_FILES) {
      setAppState(prev => ({
        ...prev,
        error: `Maximum ${MAX_TOTAL_FILES} PDF files allowed. Please remove some files first.`
      }));
      return;
    }
    
    // Create initial PDF file objects
    const newPDFs: PDFFile[] = fileArray.map(file => ({
      id: generatePdfId(),
      name: file.name,
      file,
      pages: 0,
      extractedText: '',
      isProcessing: true,
      error: undefined
    }));

    // Add PDFs to state immediately to show loading state
    setAppState(prev => ({
      ...prev,
      pdfFiles: [...prev.pdfFiles, ...newPDFs],
      activePdfId: prev.activePdfId || newPDFs[0]?.id || null,
      error: null
    }));

    // Process PDFs in parallel for better performance
    const processingPromises = newPDFs.map(async (pdfFile) => {
      try {
        const processedData = await processPDFFile(pdfFile.file);
        
        setAppState(prev => ({
          ...prev,
          pdfFiles: prev.pdfFiles.map(pdf => 
            pdf.id === pdfFile.id 
              ? {
                  ...pdf,
                  pages: processedData.totalPages,
                  extractedText: processedData.extractedText,
                  isProcessing: false
                }
              : pdf
          )
        }));
      } catch (error) {
        console.error('Error processing PDF:', error);
        setAppState(prev => ({
          ...prev,
          pdfFiles: prev.pdfFiles.map(pdf => 
            pdf.id === pdfFile.id 
              ? {
                  ...pdf,
                  isProcessing: false,
                  error: error instanceof Error ? error.message : 'Failed to process PDF'
                }
              : pdf
          )
        }));
      }
    });
    
    // Wait for all PDFs to finish processing
    await Promise.allSettled(processingPromises);
  }, []);

  // Handle navigation to citations (both manual clicks and auto-navigation)
  const [targetPageInfo, setTargetPageInfo] = useState<{documentName: string; pageNumber: number; timestamp: number} | null>(null);
  
  const navigateToCitation = useCallback((citation: Citation, isAutomatic: boolean = false) => {
    const source = isAutomatic ? 'Auto-navigation' : 'Citation clicked';
    console.log(`${source}: ${citation.documentName}, Page ${citation.pageNumber}`);
    
    // Find the PDF file that matches the citation
    const targetPdf = appState.pdfFiles.find(pdf => pdf.name === citation.documentName);
    
    if (targetPdf) {
      console.log(`Found target PDF: ${targetPdf.name} (ID: ${targetPdf.id})`);
      
      // First switch to the target PDF
      setAppState(prev => ({
        ...prev,
        activePdfId: targetPdf.id
      }));
      
      // Then set the target page for navigation with a unique timestamp
      const timestamp = Date.now();
      setTargetPageInfo({
        documentName: citation.documentName,
        pageNumber: citation.pageNumber,
        timestamp
      });
      
      console.log(`Set target page info:`, { documentName: citation.documentName, pageNumber: citation.pageNumber, timestamp });
      
      // Reset the target page info after a longer delay to allow proper scrolling
      setTimeout(() => {
        setTargetPageInfo(prev => {
          // Only clear if this is the same navigation request
          if (prev && prev.timestamp === timestamp) {
            console.log(`Clearing target page info for timestamp ${timestamp}`);
            return null;
          }
          return prev;
        });
      }, 3000); // Increased to 3 seconds to allow multiple scroll attempts
    } else {
      console.warn(`Target PDF not found for citation: ${citation.documentName}`);
      console.log('Available PDFs:', appState.pdfFiles.map(pdf => ({ name: pdf.name, id: pdf.id })));
      
      setAppState(prev => ({
        ...prev,
        error: `Document "${citation.documentName}" is no longer available.`
      }));
    }
  }, [appState.pdfFiles]);
  
  // Handle citation clicks (manual navigation)
  const handleCitationClick: OnCitationClick = useCallback((citation: Citation) => {
    navigateToCitation(citation, false);
  }, [navigateToCitation]);

  // Handle chat message submission
  const handleChatSubmit: OnChatSubmit = useCallback(async (message: string) => {
    if (!message.trim() || appState.isAiThinking) return;

    // Check if we have any processed PDFs
    const processedPDFs = appState.pdfFiles.filter(pdf => !pdf.isProcessing && !pdf.error);
    if (processedPDFs.length === 0) {
      setAppState(prev => ({
        ...prev,
        error: 'Please upload and wait for PDFs to be processed before asking questions.'
      }));
      return;
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: generateMessageId(),
      type: 'user',
      content: message.trim(),
      timestamp: new Date()
    };

    setAppState(prev => ({
      ...prev,
      chatHistory: [...prev.chatHistory, userMessage],
      isAiThinking: true,
      error: null
    }));

    try {
      // Query AI with all processed PDFs
      const aiResponse = await queryAI(message.trim(), processedPDFs);
      
      // Add AI response
      const assistantMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: aiResponse.content,
        timestamp: new Date(),
        citation: aiResponse.citation
      };

      setAppState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, assistantMessage],
        isAiThinking: false
      }));
      
      // Auto-navigate to citation if available
      if (aiResponse.citation) {
        console.log('AI response includes citation, auto-navigating...');
        // Add a small delay to allow the UI to update first
        setTimeout(() => {
          navigateToCitation(aiResponse.citation!, true);
        }, 500);
      }
    } catch (error) {
      console.error('Error querying AI:', error);
      
      const errorMessage: ChatMessage = {
        id: generateMessageId(),
        type: 'assistant',
        content: 'Sorry, I encountered an error while processing your question. Please try again.',
        timestamp: new Date()
      };

      setAppState(prev => ({
        ...prev,
        chatHistory: [...prev.chatHistory, errorMessage],
        isAiThinking: false,
        error: error instanceof Error ? error.message : 'AI service error'
      }));
    }
  }, [appState.pdfFiles, appState.isAiThinking, navigateToCitation]);

  // Handle PDF selection in sidebar
  const handlePDFSelect: OnPDFSelect = useCallback((pdfId: string) => {
    setAppState(prev => ({
      ...prev,
      activePdfId: pdfId
    }));
  }, []);

  // Handle PDF removal from sidebar
  const handlePDFRemove: OnPDFRemove = useCallback((pdfId: string) => {
    setAppState(prev => {
      const updatedPdfFiles = prev.pdfFiles.filter(pdf => pdf.id !== pdfId);
      let newActivePdfId = prev.activePdfId;
      
      // If we're removing the currently active PDF, select another one or set to null
      if (prev.activePdfId === pdfId) {
        newActivePdfId = updatedPdfFiles.length > 0 ? updatedPdfFiles[0].id : null;
      }
      
      return {
        ...prev,
        pdfFiles: updatedPdfFiles,
        activePdfId: newActivePdfId
      };
    });
  }, []);

  // Handle clearing all PDFs
  const handleClearAllPDFs = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      pdfFiles: [],
      activePdfId: null,
      chatHistory: [] // Also clear chat history when clearing all PDFs
    }));
  }, []);

  // Handle sidebar resizing
  const handleSidebarResize: OnSidebarResize = useCallback((width: number) => {
    setAppState(prev => ({
      ...prev,
      sidebarWidth: Math.max(200, Math.min(600, width))
    }));
  }, []);

  // Handle sidebar toggle
  const handleSidebarToggle: OnSidebarToggle = useCallback(() => {
    setAppState(prev => ({
      ...prev,
      sidebarCollapsed: !prev.sidebarCollapsed
    }));
  }, []);

  // Handle chat panel resizing
  const handleChatResize = useCallback((width: number) => {
    setAppState(prev => ({
      ...prev,
      chatWidth: Math.max(MIN_CHAT_WIDTH, Math.min(MAX_CHAT_WIDTH, width))
    }));
  }, []);

  // Get active PDF
  const activePdf = appState.pdfFiles.find(pdf => pdf.id === appState.activePdfId);

  // Check if we have any PDFs
  const hasPDFs = appState.pdfFiles.length > 0;
  const hasProcessedPDFs = appState.pdfFiles.some(pdf => !pdf.isProcessing && !pdf.error);

  return (
    <div className="flex h-screen w-full sm:p-4 lg:p-6 xl:p-8">
      <div className="flex flex-1 w-full h-full bg-white/80 backdrop-blur-xl sm:rounded-3xl shadow-2xl sm:border border-white/50 overflow-hidden relative">
        {/* Sidebar */}
      <PDFManagerSidebar
        pdfFiles={appState.pdfFiles}
        activePdfId={appState.activePdfId}
        collapsed={appState.sidebarCollapsed}
        width={appState.sidebarWidth}
        onPDFUpload={handlePDFUpload}
        onPDFSelect={handlePDFSelect}
        onPDFRemove={handlePDFRemove}
        onClearAll={handleClearAllPDFs}
        onResize={handleSidebarResize}
        onToggle={handleSidebarToggle}
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {!hasPDFs && appState.chatHistory.length === 0 ? (
          /* Welcome Screen */
          <WelcomeScreen onPDFUpload={handlePDFUpload} />
        ) : (
          <div className="flex-1 flex h-full min-h-0">
            {/* PDF Viewer */}
            <div className="flex-1 bg-white/50 border-r border-slate-200/60 z-10 h-full min-h-0 overflow-hidden">
              {!hasPDFs ? (
                <WelcomeScreen onPDFUpload={handlePDFUpload} />
              ) : activePdf ? (
                <PDFViewer 
                  pdfFile={activePdf}
                  targetPage={
                    // Use the targetPageInfo if it matches the current PDF
                    targetPageInfo?.documentName === activePdf.name ? targetPageInfo.pageNumber : undefined
                  }
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <div className="text-center">
                    <div className="text-6xl mb-4">📄</div>
                    <p className="text-lg">Select a PDF from the sidebar to view</p>
                  </div>
                </div>
              )}
            </div>

            {/* Chat Panel */}
            <div 
              className="bg-white h-full min-h-0 relative"
              style={{ width: `${appState.chatWidth}px` }}
            >
              {/* Resize Handle */}
              <div
                className="absolute left-0 top-0 bottom-0 w-1 bg-gray-200 hover:bg-blue-400 cursor-col-resize transition-colors duration-200 group"
                title="Drag to resize chat panel"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const startX = e.clientX;
                  const startWidth = appState.chatWidth;
                  
                  const handleMouseMove = (e: MouseEvent) => {
                    const deltaX = startX - e.clientX; // Note: reversed because we're resizing from the left
                    const newWidth = startWidth + deltaX;
                    handleChatResize(newWidth);
                  };
                  
                  const handleMouseUp = () => {
                    document.removeEventListener('mousemove', handleMouseMove);
                    document.removeEventListener('mouseup', handleMouseUp);
                    document.body.style.cursor = '';
                    document.body.style.userSelect = '';
                  };
                  
                  document.addEventListener('mousemove', handleMouseMove);
                  document.addEventListener('mouseup', handleMouseUp);
                  document.body.style.cursor = 'col-resize';
                  document.body.style.userSelect = 'none';
                }}
              />
              
              <ChatPanel
                messages={appState.chatHistory}
                isAiThinking={appState.isAiThinking}
                canSubmit={hasProcessedPDFs}
                onSubmit={handleChatSubmit}
                onCitationClick={handleCitationClick}
                activeDocumentNames={appState.pdfFiles.map(pdf => pdf.name)}
              />
            </div>
          </div>
        )}

        {/* Error Toast */}
        {appState.error && (
          <div className="fixed bottom-4 right-4 bg-red-500 text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in">
            <div className="flex items-center justify-between">
              <span>{appState.error}</span>
              <button
                onClick={() => setAppState(prev => ({ ...prev, error: null }))}
                className="ml-4 text-white hover:text-gray-200"
              >
                ×
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default App;