import { PDFFile, AIResponse, AIProviderType } from '../types/index.ts';
import { getProvider, DEFAULT_PROVIDER } from './providers/index.ts';

// Global provider selection - can be changed by user
let selectedProvider: AIProviderType = DEFAULT_PROVIDER;

/**
 * Set the current AI provider
 */
export function setAIProvider(provider: AIProviderType): void {
  selectedProvider = provider;
}

/**
 * Get the current AI provider
 */
export function getCurrentAIProvider(): AIProviderType {
  return selectedProvider;
}

/**
 * Mock AI response for development/demo purposes
 * In a real implementation, replace this with actual AI API calls
 */
function getRandomPage(pdf?: PDFFile): number {
  const totalPages = Math.max(1, pdf?.pages || 1);
  return Math.floor(Math.random() * totalPages) + 1;
}

function createMockAIResponse(question: string, pdfFiles: PDFFile[]): AIResponse {
  const providerName = getProvider(selectedProvider).config.name;
  const responses = [
    {
      content: `### Document Analysis Results

Based on the documents provided (analyzed by **${providerName}**), I can provide the following insights:

- The **key points** are outlined in the document structure
- Important information is distributed across multiple sections
- Technical details are properly documented

This analysis covers the main aspects relevant to your question with supporting information from the source material.`,
      citation: {
        documentName: pdfFiles[0]?.name || 'document.pdf',
        pageNumber: getRandomPage(pdfFiles[0])
      }
    },
    {
      content: `## Key Findings

The document indicates that this topic is discussed in **comprehensive detail** (${providerName} analysis). Here are the main points:

1. **Primary concepts** are well-defined
2. Supporting evidence is provided throughout
3. Practical applications are demonstrated

*Note: This information spans multiple sections of the document for thorough coverage.*`,
      citation: {
        documentName: pdfFiles[0]?.name || 'document.pdf',
        pageNumber: getRandomPage(pdfFiles[0])
      }
    },
    {
      content: `According to the provided documents (processed via **${providerName}**), the information you're looking for includes:

- **Core concepts** are clearly explained
- \`Technical specifications\` are provided where applicable
- Step-by-step guidance is available

The document provides **comprehensive coverage** of this topic with detailed explanations and practical examples.`,
      citation: {
        documentName: pdfFiles[0]?.name || 'document.pdf',
        pageNumber: getRandomPage(pdfFiles[0])
      }
    }
  ];

  return responses[Math.floor(Math.random() * responses.length)];
}

/**
 * Get API key for the selected provider
 */
function getAPIKey(providerType: AIProviderType): string {
  const rawApiKey = providerType === 'openai' 
    ? import.meta.env.VITE_OPENAI_API_KEY
    : import.meta.env.VITE_GEMINI_API_KEY;
  
  return rawApiKey ? rawApiKey.replace(/\u0000/g, '').trim() : '';
}

/**
 * Check if API key is valid for the provider
 */
function isValidAPIKey(providerType: AIProviderType, apiKey: string): boolean {
  if (!apiKey) return false;
  
  switch (providerType) {
    case 'openai':
      return apiKey !== 'your_openai_api_key_here' && apiKey.startsWith('sk-');
    case 'gemini':
      return apiKey !== 'your_gemini_api_key_here' && apiKey.length > 10;
    default:
      return false;
  }
}

/**
 * Main function to query the AI with a question and PDF content
 */
export async function queryAI(question: string, pdfFiles: PDFFile[]): Promise<AIResponse> {
  // Validate inputs
  if (!question.trim()) {
    throw new Error('Question cannot be empty');
  }

  if (pdfFiles.length === 0) {
    throw new Error('No PDF files provided');
  }

  // Filter out PDFs that are still processing or have errors
  const validPDFs = pdfFiles.filter(pdf => !pdf.isProcessing && !pdf.error && pdf.extractedText);

  if (validPDFs.length === 0) {
    throw new Error('No processed PDF files available');
  }

  try {
    // Get current provider and API key
    const provider = getProvider(selectedProvider);
    const apiKey = getAPIKey(selectedProvider);
    const shouldUseMock = !isValidAPIKey(selectedProvider, apiKey);
    
    if (shouldUseMock) {
      const envVar = selectedProvider === 'openai' ? 'VITE_OPENAI_API_KEY' : 'VITE_GEMINI_API_KEY';
      console.warn(`Using mock AI responses. Set ${envVar} in .env file to use real ${provider.config.name} API.`);
      return createMockAIResponse(question, validPDFs);
    }

    // Use real AI API
    return await provider.callAPI(question, validPDFs, apiKey);

  } catch (error) {
    console.error('Error querying AI:', error);
    throw new Error(error instanceof Error ? error.message : 'Failed to get AI response');
  }
}

// Export provider functions for use in components
export { getAvailableProviders } from './providers/index.ts';
