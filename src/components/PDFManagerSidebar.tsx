import React, { useRef, useCallback, useEffect, useState } from 'react';
import { PDFFile, OnPDFUpload, OnPDFSelect, OnPDFRemove, OnClearAllPDFs, OnSidebarResize, OnSidebarToggle } from '../types/index.ts';

interface PDFManagerSidebarProps {
  pdfFiles: PDFFile[];
  activePdfId: string | null;
  collapsed: boolean;
  width: number;
  onPDFUpload: OnPDFUpload;
  onPDFSelect: OnPDFSelect;
  onPDFRemove: OnPDFRemove;
  onClearAll: OnClearAllPDFs;
  onResize: OnSidebarResize;
  onToggle: OnSidebarToggle;
}

export const PDFManagerSidebar: React.FC<PDFManagerSidebarProps> = ({
  pdfFiles,
  activePdfId,
  collapsed,
  width,
  onPDFUpload,
  onPDFSelect,
  onPDFRemove,
  onClearAll,
  onResize,
  onToggle
}) => {
  const sidebarRef = useRef<HTMLDivElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);

  // Handle file input change
  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      onPDFUpload(files);
    }
    // Reset input value to allow re-uploading the same file
    event.target.value = '';
  }, [onPDFUpload]);

  // Handle drag and drop
  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    const files = event.dataTransfer.files;
    if (files.length > 0) {
      onPDFUpload(files);
    }
  }, [onPDFUpload]);

  // Handle resize functionality
  const handleResizeStart = useCallback((event: React.MouseEvent) => {
    if (collapsed) return;

    setIsDragging(true);
    const rect = sidebarRef.current?.getBoundingClientRect();
    if (rect) {
      setDragOffset(event.clientX - rect.right);
    }

    event.preventDefault();
  }, [collapsed]);

  const handleResizeMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;

    const rect = sidebarRef.current?.getBoundingClientRect();
    if (rect) {
      const newWidth = event.clientX - rect.left - dragOffset;
      onResize(newWidth);
    }
  }, [isDragging, dragOffset, onResize]);

  const handleResizeEnd = useCallback(() => {
    setIsDragging(false);
    setDragOffset(0);
  }, []);

  // Add mouse event listeners for resize
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleResizeMove);
      document.removeEventListener('mouseup', handleResizeEnd);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isDragging, handleResizeMove, handleResizeEnd]);

  // Upload button click handler
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div
      ref={sidebarRef}
      className={`relative bg-slate-50/40 backdrop-blur-sm border-r border-slate-200/60 transition-all duration-300 ease-in-out flex flex-col z-20 ${collapsed ? 'w-12' : ''
        }`}
      style={{ width: collapsed ? 48 : width }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-200/60">
        {!collapsed && (
          <div className="flex items-center space-x-2">
            <h2 className="text-sm font-semibold text-slate-800 uppercase tracking-wider">Documents</h2>
            {pdfFiles.length > 0 && (
              <button
                onClick={onClearAll}
                className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                title="Clear all PDFs"
              >
                Clear All
              </button>
            )}
          </div>
        )}
        <button
          onClick={onToggle}
          className="p-1.5 rounded-lg hover:bg-slate-200/50 text-slate-500 hover:text-slate-700 transition-all"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          )}
        </button>
      </div>

      {!collapsed && (
        <>
          {/* PDF List */}
          <div className="flex-1 overflow-y-auto p-2">
            {pdfFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-500 px-4 mt-8">
                <div className="w-16 h-16 mb-4 rounded-2xl bg-white shadow-sm border border-slate-100 flex items-center justify-center animate-fade-in">
                  <svg className="w-8 h-8 text-primary-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-slate-700 mb-2">No documents</p>
                <p className="text-xs text-slate-500 text-center">
                  Upload your PDFs to start analyzing and querying them.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pdfFiles.map(pdf => (
                  <div
                    key={pdf.id}
                    className={`
                      group relative p-3 rounded-xl border transition-all duration-300 backdrop-blur-sm
                      ${activePdfId === pdf.id
                        ? 'border-primary-300 bg-white shadow-sm ring-1 ring-primary-500/20'
                        : 'border-transparent hover:border-slate-200 hover:bg-white/80'
                      }
                      ${pdf.isProcessing || pdf.error ? 'opacity-75' : ''}
                    `}
                  >
                    <div
                      onClick={() => !pdf.isProcessing && !pdf.error && onPDFSelect(pdf.id)}
                      className={`${pdf.isProcessing || pdf.error ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="flex items-center space-x-3">
                            <div className={`flex items-center justify-center w-10 h-10 rounded-lg shrink-0 ${activePdfId === pdf.id ? 'bg-primary-50 text-primary-600' : 'bg-slate-100 text-slate-400 group-hover:text-primary-500'} transition-colors duration-300`}>
                              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                              </svg>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className={`text-sm font-medium truncate transition-colors ${activePdfId === pdf.id ? 'text-primary-900' : 'text-slate-700'}`}
                                title={pdf.name}
                              >
                                {pdf.name}
                              </p>
                              {pdf.pages > 0 && (
                                <p className={`text-xs mt-0.5 transition-colors ${activePdfId === pdf.id ? 'text-primary-600/80' : 'text-slate-500'}`}>
                                  {pdf.pages} pages • {formatFileSize(pdf.file.size)}
                                </p>
                              )}
                            </div>
                          </div>

                          {pdf.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                              Error: {pdf.error}
                            </div>
                          )}
                        </div>

                        <div className="flex items-center space-x-1">
                          {pdf.isProcessing && (
                            <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full"></div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Remove button - appears on hover */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPDFRemove(pdf.id);
                      }}
                      className="absolute top-1/2 -translate-y-1/2 right-3 opacity-0 group-hover:opacity-100 bg-white hover:bg-red-50 text-slate-400 hover:text-red-500 border border-slate-200 rounded-full w-7 h-7 flex items-center justify-center transition-all duration-200 shadow-sm"
                      title="Remove PDF"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload Section */}
          <div className="p-4 border-t border-slate-200/60 bg-slate-50/30">
            <button
              onClick={handleUploadClick}
              className="group relative w-full flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-300 rounded-xl bg-white/60 hover:bg-white hover:border-primary-400 hover:shadow-sm transition-all duration-300 mt-2"
            >
              <div className="p-2.5 bg-slate-100 group-hover:bg-primary-50 rounded-full mb-2.5 transition-colors duration-300">
                <svg className="w-5 h-5 text-slate-500 group-hover:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <span className="text-sm font-semibold text-slate-700 group-hover:text-primary-600 transition-colors">Upload PDF</span>
              <span className="text-xs text-slate-500 mt-1 text-center">Drag and drop files here</span>
            </button>

            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </div>
        </>
      )}

      {/* Resize Handle */}
      {!collapsed && (
        <div
          ref={resizeRef}
          className="absolute top-0 right-0 w-1.5 h-full resize-handle hover:bg-primary-400 transition-colors cursor-col-resize z-50"
          onMouseDown={handleResizeStart}
        />
      )}

      {/* Drag overlay for better visual feedback */}
      <div className="absolute inset-0 pointer-events-none">
        {/* This will be styled with CSS when dragging over */}
      </div>
    </div>
  );
};

export default PDFManagerSidebar;