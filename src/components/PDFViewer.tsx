import React, { useRef, useEffect, useState, useCallback } from 'react';
import { PDFFile, PDFDocumentProxy, PDFPageProxy, PDFViewerState } from '../types/index.ts';

interface PDFViewerProps {
  pdfFile: PDFFile;
  targetPage?: number;
}

interface PDFPageComponentProps {
  pageNumber: number;
  document: PDFDocumentProxy;
  scale: number;
  isVisible: boolean;
  onPageRendered: (pageNumber: number) => void;
}

const PDFPageComponent: React.FC<PDFPageComponentProps> = ({
  pageNumber,
  document,
  scale,
  isVisible,
  onPageRendered
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isRendering, setIsRendering] = useState(false);
  const renderedScaleRef = useRef<number | null>(null);
  const renderTaskRef = useRef<any>(null);
  const isMountedRef = useRef(true);

  const renderPage = useCallback(async () => {
    if (!canvasRef.current || isRendering || !isMountedRef.current) return;

    // Skip if already rendered at this scale
    if (renderedScaleRef.current === scale) return;

    // Cancel any ongoing render task
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    try {
      setIsRendering(true);
      console.log(`Rendering page ${pageNumber} at scale ${scale}`);

      const page = await document.getPage(pageNumber);
      const pageViewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      if (!canvas || !isMountedRef.current) return;

      const context = canvas.getContext('2d');
      if (!context) return;

      // Set canvas dimensions
      canvas.height = pageViewport.height;
      canvas.width = pageViewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: pageViewport,
      };

      // Render the page
      renderTaskRef.current = page.render(renderContext);
      await renderTaskRef.current.promise;

      if (!isMountedRef.current) return;

      // Mark this scale as rendered
      renderedScaleRef.current = scale;
      renderTaskRef.current = null;

      onPageRendered(pageNumber);
      console.log(`Page ${pageNumber} rendered successfully at scale ${scale}`);
    } catch (error: any) {
      if (error?.name === 'RenderingCancelledException') {
        console.log(`Rendering cancelled for page ${pageNumber}`);
      } else {
        console.error(`Error rendering page ${pageNumber}:`, error);
      }
    } finally {
      if (isMountedRef.current) {
        setIsRendering(false);
      }
    }
  }, [document, pageNumber, scale, onPageRendered, isRendering]);

  // Trigger render when page becomes visible or scale changes
  useEffect(() => {
    if (isVisible && !isRendering && renderedScaleRef.current !== scale) {
      renderPage();
    }
  }, [isVisible, scale, renderPage, isRendering]);

  // Cleanup on unmount - cancel any pending render tasks
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (renderTaskRef.current) {
        console.log(`Cancelling render task for page ${pageNumber} on unmount`);
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [pageNumber]);

  if (!isVisible && renderedScaleRef.current === null) {
    return (
      <div
        className="flex justify-center p-8 bg-slate-50/50 min-h-[800px]"
      >
        <div className="w-full max-w-[800px] bg-white rounded-xl shadow-sm border border-slate-200 animate-pulse flex items-center justify-center">
          <div className="text-center text-slate-400">
            <svg className="w-12 h-12 mx-auto mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium">Loading Page {pageNumber}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-center bg-slate-50/50 p-6 md:p-8 flex-shrink-0">
      <div className="relative group bg-white shadow-xl shadow-slate-200/50 rounded-lg ring-1 ring-slate-200 max-w-full overflow-hidden transition-shadow duration-300 hover:shadow-2xl hover:shadow-slate-300/50">
        {/* Page number overlay */}
        <div className="absolute top-4 right-4 bg-slate-800/80 backdrop-blur-md text-white px-3 py-1 rounded-full text-xs font-semibold shadow-sm z-10 transition-opacity opacity-0 hover:opacity-100 group-hover:opacity-100">
          Page {pageNumber}
        </div>

        {isRendering && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur-sm z-20">
            <div className="text-center bg-white p-4 rounded-xl shadow-lg border border-slate-100">
              <div className="animate-spin h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full mx-auto mb-3"></div>
              <p className="text-sm font-medium text-slate-600">Rendering...</p>
            </div>
          </div>
        )}

        <canvas
          ref={canvasRef}
          className={`block transition-opacity duration-300 ${isRendering ? 'opacity-40' : 'opacity-100'}`}
          style={{
            maxWidth: '100%',
            height: 'auto'
          }}
        />
      </div>
    </div>
  );
};

export const PDFViewer: React.FC<PDFViewerProps> = ({ pdfFile, targetPage }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const pageRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const [viewerState, setViewerState] = useState<PDFViewerState>({
    scale: 1.0,
    currentPage: 1,
    totalPages: 0,
    pagesRendered: new Set(),
    scrollToPage: targetPage
  });

  const [document, setDocument] = useState<PDFDocumentProxy | null>(null);
  const [visiblePages, setVisiblePages] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load PDF document
  useEffect(() => {
    let isMounted = true;
    let currentDoc: PDFDocumentProxy | null = null;

    const loadPDF = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const arrayBuffer = await pdfFile.file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        const pdfDoc = await window.pdfjsLib.getDocument(uint8Array).promise;

        if (!isMounted) {
          // Component unmounted before PDF loaded, clean up
          console.log('Component unmounted before PDF loaded, cleaning up');
          await pdfDoc.cleanup();
          await pdfDoc.destroy();
          return;
        }

        currentDoc = pdfDoc;
        setDocument(pdfDoc);
        setViewerState(prev => ({
          ...prev,
          totalPages: pdfDoc.numPages
        }));
      } catch (err) {
        console.error('Error loading PDF:', err);
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to load PDF');
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    if (pdfFile && !pdfFile.isProcessing && !pdfFile.error) {
      loadPDF();
    }

    // Cleanup function - destroy PDF document when switching PDFs or unmounting
    return () => {
      isMounted = false;
      if (currentDoc) {
        console.log(`Cleaning up PDF document: ${pdfFile.name}`);
        currentDoc.cleanup().catch((err) => {
          console.warn('Error during PDF cleanup:', err);
        });
        currentDoc.destroy().catch((err) => {
          console.warn('Error during PDF destroy:', err);
        });
      }
      // Also cleanup the document from state if it exists
      if (document && document !== currentDoc) {
        console.log('Cleaning up previous document from state');
        document.cleanup().catch((err) => {
          console.warn('Error during previous PDF cleanup:', err);
        });
        document.destroy().catch((err) => {
          console.warn('Error during previous PDF destroy:', err);
        });
      }
    };
  }, [pdfFile]);

  // Set up intersection observer for lazy loading
  const setupIntersectionObserver = useCallback(() => {
    if (!document || !containerRef.current) return;

    // Disconnect existing observer if any
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    // Clear any existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Debounce updates to prevent excessive re-renders
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
        }

        debounceTimerRef.current = setTimeout(() => {
          let hasChanges = false;
          const newVisiblePages = new Set(visiblePages);

          entries.forEach((entry) => {
            const pageNumber = parseInt(entry.target.getAttribute('data-page-number') || '0');

            if (entry.isIntersecting) {
              // Only add current page and immediate neighbors
              for (let i = Math.max(1, pageNumber - 1); i <= Math.min(viewerState.totalPages, pageNumber + 1); i++) {
                if (!newVisiblePages.has(i)) {
                  newVisiblePages.add(i);
                  hasChanges = true;
                }
              }
            }
          });

          if (hasChanges) {
            setVisiblePages(newVisiblePages);
          }

          // Update current page based on which page is most visible
          const visibleEntries = entries.filter(entry => entry.isIntersecting);
          if (visibleEntries.length > 0) {
            const mostVisibleEntry = visibleEntries.reduce((prev, current) =>
              prev.intersectionRatio > current.intersectionRatio ? prev : current
            );
            const currentPageNumber = parseInt(mostVisibleEntry.target.getAttribute('data-page-number') || '1');

            setViewerState(prev => {
              if (prev.currentPage !== currentPageNumber) {
                return { ...prev, currentPage: currentPageNumber };
              }
              return prev;
            });
          }
        }, 100); // 100ms debounce
      },
      {
        root: containerRef.current,
        rootMargin: '50px',
        threshold: [0, 0.5]
      }
    );

    // Observe all page elements
    pageRefs.current.forEach((pageElement) => {
      if (observerRef.current) {
        observerRef.current.observe(pageElement);
      }
    });

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
    };
  }, [document, viewerState.totalPages, visiblePages]);

  useEffect(() => {
    const cleanup = setupIntersectionObserver();
    return cleanup;
  }, [setupIntersectionObserver]);

  // Global cleanup on component unmount
  useEffect(() => {
    return () => {
      console.log('PDFViewer unmounting, performing final cleanup');

      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      // Disconnect observer
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      // Clear page refs
      pageRefs.current.clear();
    };
  }, []);

  // When scale changes, force update visible pages to trigger re-render
  useEffect(() => {
    if (document && visiblePages.size > 0) {
      console.log(`Scale changed to ${viewerState.scale}. Triggering re-render for ${visiblePages.size} visible pages.`);
      // Force a state update to trigger re-render in child components
      // This creates a new Set reference, causing React to re-render
      setVisiblePages(new Set(visiblePages));
    }
  }, [viewerState.scale]);


  // Handle target page scrolling
  useEffect(() => {
    if (targetPage && document && containerRef.current) {
      console.log(`Attempting to navigate to page ${targetPage}`);

      const scrollToTargetPage = () => {
        const pageElement = pageRefs.current.get(targetPage);
        if (pageElement) {
          console.log(`Found page element for page ${targetPage}, scrolling...`);

          // Temporarily disable the intersection observer to prevent interference
          if (observerRef.current) {
            observerRef.current.disconnect();
          }

          // Scroll to the target page
          pageElement.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });

          // Update the current page indicator
          setViewerState(prev => ({
            ...prev,
            currentPage: targetPage
          }));

          // Re-enable intersection observer after scrolling
          setTimeout(() => {
            // Re-setup the entire intersection observer
            setupIntersectionObserver();
          }, 1000);

          console.log(`Successfully navigated to page ${targetPage}`);
        } else {
          console.warn(`Page element for page ${targetPage} not found in pageRefs. Available pages:`, Array.from(pageRefs.current.keys()));

          // Try multiple fallback approaches
          // 1. Try to find the page element by data attribute
          const pageElementBySelector = containerRef.current?.querySelector(`[data-page-number="${targetPage}"]`) as HTMLDivElement;
          if (pageElementBySelector) {
            console.log(`Found page element by selector for page ${targetPage}`);
            pageElementBySelector.scrollIntoView({
              behavior: 'smooth',
              block: 'start'
            });
            setViewerState(prev => ({ ...prev, currentPage: targetPage }));
            return;
          }

          // 2. If the page element isn't ready, try scrolling by calculating position
          console.log(`Falling back to estimated position for page ${targetPage}`);
          if (containerRef.current) {
            const estimatedPosition = (targetPage - 1) * 850; // Slightly increased estimate
            containerRef.current.scrollTo({
              top: estimatedPosition,
              behavior: 'smooth'
            });
            setViewerState(prev => ({ ...prev, currentPage: targetPage }));
          }
        }
      };

      // Try multiple times with increasing delays to ensure page elements are ready
      const tryScroll = (attempt: number = 1) => {
        if (attempt > 5) {
          console.error(`Failed to scroll to page ${targetPage} after 5 attempts`);
          return;
        }

        const delay = attempt * 300; // 300ms, 600ms, 900ms, etc.
        setTimeout(() => {
          const pageElement = pageRefs.current.get(targetPage);
          if (pageElement) {
            scrollToTargetPage();
          } else {
            console.log(`Attempt ${attempt}: Page element not ready, retrying...`);
            tryScroll(attempt + 1);
          }
        }, delay);
      };

      tryScroll();
    }
  }, [targetPage, document, pageRefs]);

  // Zoom handlers
  const zoomIn = useCallback(() => {
    setViewerState(prev => {
      const newScale = Math.min(3.0, prev.scale + 0.5);
      if (newScale !== prev.scale) {
        console.log(`Zooming in from ${prev.scale} to ${newScale}`);
        return {
          ...prev,
          scale: newScale,
          pagesRendered: new Set() // Clear to force re-render at new scale
        };
      }
      return prev;
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewerState(prev => {
      const newScale = Math.max(0.5, prev.scale - 0.5);
      if (newScale !== prev.scale) {
        console.log(`Zooming out from ${prev.scale} to ${newScale}`);
        return {
          ...prev,
          scale: newScale,
          pagesRendered: new Set() // Clear to force re-render at new scale
        };
      }
      return prev;
    });
  }, []);

  const resetZoom = useCallback(() => {
    setViewerState(prev => {
      if (prev.scale !== 1.0) {
        console.log(`Resetting zoom from ${prev.scale} to 1.0`);
        return {
          ...prev,
          scale: 1.0,
          pagesRendered: new Set() // Clear to force re-render at new scale
        };
      }
      return prev;
    });
  }, []);

  // Handle page rendered callback
  const handlePageRendered = useCallback((pageNumber: number) => {
    setViewerState(prev => ({
      ...prev,
      pagesRendered: new Set([...prev.pagesRendered, pageNumber])
    }));
  }, []);

  // Register page ref
  const registerPageRef = useCallback((pageNumber: number, element: HTMLDivElement | null) => {
    if (element) {
      pageRefs.current.set(pageNumber, element);
    } else {
      pageRefs.current.delete(pageNumber);
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-sm w-full mx-4">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 rounded-full border-4 border-slate-100"></div>
            <div className="absolute inset-0 rounded-full border-4 border-primary-500 border-t-transparent animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-primary-500">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            </div>
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-2">Loading Document</p>
          <p className="text-sm text-slate-500 truncate" title={pdfFile.name}>{pdfFile.name}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <div className="text-center bg-white p-8 rounded-3xl shadow-sm border border-red-100 max-w-sm w-full mx-4">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <p className="text-lg font-semibold text-slate-800 mb-2">Failed to load PDF</p>
          <p className="text-sm text-slate-500">{error}</p>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="flex-1 flex items-center justify-center bg-slate-50/50">
        <div className="text-center">
          <div className="w-20 h-20 bg-slate-100 text-slate-400 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-inner">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" /></svg>
          </div>
          <p className="text-lg font-medium text-slate-600">No Document Loaded</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-white/60 backdrop-blur-md border-b border-slate-200/60 shadow-sm flex-shrink-0 z-10">
        <div className="flex items-center space-x-4">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-50 text-primary-600 shrink-0">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-slate-800 truncate max-w-md" title={pdfFile.name}>
            {pdfFile.name}
          </h3>
        </div>

        <div className="flex items-center space-x-6">
          {/* Page indicator */}
          <div className="flex items-center space-x-1 text-sm font-medium bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm">
            <span className="text-slate-700">{viewerState.currentPage}</span>
            <span className="text-slate-400">/</span>
            <span className="text-slate-500">{viewerState.totalPages}</span>
          </div>

          {/* Zoom controls */}
          <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg shadow-sm p-1">
            <button
              onClick={zoomOut}
              disabled={viewerState.scale <= 0.5}
              className="p-1.5 text-slate-600 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom out"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H9" />
              </svg>
            </button>

            <button
              onClick={resetZoom}
              className="px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100 rounded-md min-w-[3.5rem] transition-colors"
              title="Reset zoom"
            >
              {Math.round(viewerState.scale * 100)}%
            </button>

            <button
              onClick={zoomIn}
              disabled={viewerState.scale >= 3.0}
              className="p-1.5 text-slate-600 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
              title="Zoom in"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM15 10l-2 0m0 0l-2 0m2 0v2m0-2v-2" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* PDF Pages */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollBehavior: 'smooth' }}
      >
        {Array.from({ length: viewerState.totalPages }, (_, index) => {
          const pageNumber = index + 1;
          return (
            <div
              key={pageNumber}
              ref={(el) => registerPageRef(pageNumber, el)}
              data-page-number={pageNumber}
              className="page-container"
            >
              <PDFPageComponent
                pageNumber={pageNumber}
                document={document}
                scale={viewerState.scale}
                isVisible={visiblePages.has(pageNumber)}
                onPageRendered={handlePageRendered}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PDFViewer;