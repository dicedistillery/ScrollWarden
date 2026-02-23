import React, { useRef, useCallback, useState } from 'react';
import { OnPDFUpload } from '../types/index.ts';

interface WelcomeScreenProps {
  onPDFUpload: OnPDFUpload;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ onPDFUpload }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleFileSelect = useCallback((files: FileList | null) => {
    if (files && files.length > 0) {
      onPDFUpload(files);
    }
  }, [onPDFUpload]);

  const handleFileInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    handleFileSelect(event.target.files);
    // Reset input to allow re-selecting the same file
    event.target.value = '';
  }, [handleFileSelect]);

  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }, [isDragOver]);

  const handleDragLeave = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    // Only set dragOver to false if we're leaving the drop zone entirely
    if (event.currentTarget === event.target) {
      setIsDragOver(false);
    }
  }, []);

  const handleDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);

    const files = event.dataTransfer.files;
    handleFileSelect(files);
  }, [handleFileSelect]);

  return (
    <div
      className={`flex-1 flex flex-col items-center justify-center transition-all duration-500 overflow-y-auto ${isDragOver ? 'bg-primary-50/50 scale-[1.02]' : 'bg-transparent'
        }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      <div className="text-center max-w-3xl mx-auto p-8 w-full animate-slide-up">
        {/* Main Icon */}
        <div className={`relative inline-flex items-center justify-center w-28 h-28 mb-8 rounded-3xl bg-white shadow-xl shadow-primary-500/10 border border-slate-100 transition-transform duration-500 ${isDragOver ? 'scale-110' : 'hover:scale-105'}`}>
          <div className="absolute inset-0 bg-gradient-to-tr from-primary-100 to-indigo-50 rounded-3xl opacity-50"></div>
          <svg className="w-14 h-14 text-primary-500 relative z-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
          </svg>
        </div>

        {/* Title */}
        <h1 className="text-5xl font-bold text-slate-800 mb-5 tracking-tight">
          Scroll Warden
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-slate-500 mb-10 max-w-2xl mx-auto leading-relaxed">
          Your vigilant guardian for document exploration. Upload your PDFs
          and let intelligent search guide you to the exact information you need.
        </p>

        {/* Upload Area */}
        <div
          className={`
            group relative border-2 border-dashed rounded-2xl p-10 md:p-14 mb-12 transition-all duration-300 cursor-pointer overflow-hidden
            ${isDragOver
              ? 'border-primary-500 bg-primary-50/50 shadow-xl'
              : 'border-slate-300 bg-white hover:border-primary-400 hover:shadow-lg hover:shadow-primary-500/5'
            }
          `}
          onClick={handleUploadClick}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary-50/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          <div className="relative z-10 flex flex-col items-center space-y-6">
            <div className={`w-20 h-20 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center transition-transform duration-500 ${isDragOver ? 'scale-110 animate-pulse' : 'group-hover:scale-110 group-hover:bg-primary-200'}`}>
              <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
            </div>

            <div className="text-center">
              <h3 className="text-2xl font-semibold text-slate-800 mb-2">
                {isDragOver ? 'Drop your files to upload' : 'Click to upload or drag and drop'}
              </h3>
              <p className="text-slate-500">
                PDF documents up to 80MB each
              </p>
            </div>

            <button className="px-8 py-3.5 bg-primary-600 text-white font-medium rounded-xl hover:bg-primary-700 transition-all shadow-md hover:shadow-xl hover:shadow-primary-500/20 active:scale-95">
              Select Files
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 text-left">
          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-2">Smart Search</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              Ask natural language questions and get intelligent answers based on your document content.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="w-12 h-12 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-2">Precise Citations</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              Every answer includes clickable citations that take you directly to the relevant page.
            </p>
          </div>

          <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl shadow-sm border border-slate-200/60 hover:shadow-md hover:border-slate-300 transition-all duration-300">
            <div className="w-12 h-12 bg-teal-50 text-teal-500 rounded-xl flex items-center justify-center mb-4">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
            </div>
            <h4 className="font-semibold text-slate-800 mb-2">Lightning Fast</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              No installation required. All processing happens locally in your browser for privacy and speed.
            </p>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-10 flex items-center justify-center space-x-6 text-sm text-slate-400">
          <span className="flex items-center"><svg className="w-4 h-4 mr-1.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Multiple Files</span>
          <span className="flex items-center"><svg className="w-4 h-4 mr-1.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Local Processing</span>
          <span className="flex items-center"><svg className="w-4 h-4 mr-1.5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg> Instant Answers</span>
        </div>

        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          multiple
          onChange={handleFileInputChange}
          className="hidden"
        />
      </div>
    </div>
  );
};

export default WelcomeScreen;