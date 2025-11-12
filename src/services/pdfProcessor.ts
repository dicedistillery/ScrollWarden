import { PDFDocumentProxy, PDFPageProxy } from '../types/index.ts';

export interface ProcessedPDFData {
  totalPages: number;
  extractedText: string;
}

/**
 * Extracts text from a single PDF page
 */
async function extractPageText(page: PDFPageProxy, pageNumber: number): Promise<string> {
  try {
    const textContent = await page.getTextContent();
    const textItems = textContent.items;
    
    // Combine all text items on the page
    const pageText = textItems
      .map((item: any) => item.str || '')
      .join(' ')
      .trim();
    
    // Add page marker at the beginning of each page's content
    return `[Page ${pageNumber}]\n${pageText}\n\n`;
  } catch (error) {
    console.error(`Error extracting text from page ${pageNumber}:`, error);
    return `[Page ${pageNumber}]\n[Error: Could not extract text from this page]\n\n`;
  }
}

/**
 * Processes a PDF file and extracts all text content with page markers
 */
export async function processPDFFile(file: File): Promise<ProcessedPDFData> {
  if (!file || file.type !== 'application/pdf') {
    throw new Error('Invalid file type. Please provide a PDF file.');
  }

  try {
    // Convert file to array buffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    // Load the PDF document using pdf.js
    const pdfDocument = await window.pdfjsLib.getDocument(uint8Array).promise;
    const totalPages = pdfDocument.numPages;

    if (totalPages === 0) {
      throw new Error('PDF file appears to be empty or corrupted.');
    }

    let extractedText = '';

    // Process each page sequentially to maintain order
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      try {
        const page = await pdfDocument.getPage(pageNumber);
        const pageText = await extractPageText(page, pageNumber);
        extractedText += pageText;
      } catch (error) {
        console.error(`Error processing page ${pageNumber}:`, error);
        // Continue with other pages even if one fails
        extractedText += `[Page ${pageNumber}]\n[Error: Could not process this page]\n\n`;
      }
    }

    // Clean up the extracted text
    extractedText = cleanExtractedText(extractedText);

    // Clean up the PDF document to free memory
    try {
      await pdfDocument.cleanup();
      await pdfDocument.destroy();
    } catch (cleanupError) {
      console.warn('Error during PDF cleanup:', cleanupError);
      // Continue anyway as the main task is complete
    }

    return {
      totalPages,
      extractedText
    };

  } catch (error) {
    console.error('Error processing PDF file:', error);
    
    if (error instanceof Error) {
      if (error.message.includes('Invalid PDF')) {
        throw new Error('Invalid PDF file format.');
      } else if (error.message.includes('password')) {
        throw new Error('Password-protected PDFs are not supported.');
      } else {
        throw new Error(`Failed to process PDF: ${error.message}`);
      }
    } else {
      throw new Error('An unknown error occurred while processing the PDF.');
    }
  }
}

/**
 * Cleans and normalizes the extracted text
 */
function cleanExtractedText(text: string): string {
  return text
    // Remove excessive whitespace
    .replace(/\s+/g, ' ')
    // Remove excessive line breaks
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    // Trim each line
    .split('\n')
    .map(line => line.trim())
    .join('\n')
    // Final trim
    .trim();
}