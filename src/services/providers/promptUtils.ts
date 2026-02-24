import { PDFFile } from '../../types/index.ts';

/**
 * Sanitizes text to prevent prompt injection attacks
 */
function sanitizeText(text: string): string {
  // Remove potential prompt injection patterns
  return text
    .replace(/(\r\n|\n|\r)/g, ' ') // Normalize line breaks
    .replace(/[^\x20-\x7E\u00A0-\uFFFF]/g, '') // Remove non-printable characters
    .trim();
}

/**
 * Sanitizes user input to prevent prompt injection
 */
export function sanitizeUserInput(input: string): string {
  // Limit length to prevent abuse
  const maxLength = 1000;
  let sanitized = sanitizeText(input);

  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength) + '...';
  }

  return sanitized;
}

/**
 * Constructs a detailed prompt for AI providers to answer questions based on PDF content
 * This shared implementation ensures consistency across all providers
 */
export function constructAIPrompt(question: string, pdfFiles: PDFFile[]): string {
  // Sanitize the question
  const sanitizedQuestion = sanitizeUserInput(question);

  // Construct document texts with size limits to prevent token overflow
  const MAX_CHARS_PER_DOC = 50000; // Reasonable limit per document
  const documentTexts = pdfFiles.map(pdf => {
    const text = pdf.extractedText.length > MAX_CHARS_PER_DOC
      ? pdf.extractedText.substring(0, MAX_CHARS_PER_DOC) + '\n[Content truncated due to length...]'
      : pdf.extractedText;

    return `START OF DOCUMENT: ${sanitizeText(pdf.name)}\n${text}\nEND OF DOCUMENT: ${sanitizeText(pdf.name)}\n\n`;
  }).join('');

  const prompt = `You are a knowledgeable AI assistant and an expert document analyst. You help users with their questions, primarily by analyzing the provided PDF documents. You are also capable of answering general questions using your broad knowledge base, such as questions about tabletop RPGs (e.g., D&D 5e).

IMPORTANT RULES:
1. ALWAYS prioritize finding the answer within the provided documents.
2. If you find the answer in the documents, you MUST end your response with a citation in this EXACT format: "Source: [Document Name], Page X". Use the most relevant page number.
3. If the information is NOT in the documents, you may use your general knowledge to answer the question. If you do this, clearly state that your answer is based on general knowledge and NOT the provided documents. DO NOT include a citation format.
4. If you rely on general knowledge, be helpful and comprehensive in your answer.
5. If information spans multiple pages, cite the page with the most relevant details.
6. Format your response using markdown for better readability:
   - Use **bold** for important terms
   - Use bullet points (-) for lists
   - Use ### for section headers when appropriate
   - Use \`code\` for technical terms or specific values
   - Use numbered lists (1.) for step-by-step information

DOCUMENTS:
${documentTexts}

QUESTION: ${sanitizedQuestion}

Provide your answer according to the rules above.`;

  return prompt;
}

/**
 * Parses AI response to extract the main content and citation
 * Shared implementation ensures consistent citation parsing across providers
 */
export function parseAIResponse(responseText: string): {
  content: string;
  citation?: {
    documentName: string;
    pageNumber: number;
  };
} {
  // Look for citation pattern: "Source: [Document Name], Page X"
  const citationRegex = /Source:\s*([^,]+),\s*Page\s*(\d+)/i;
  const match = responseText.match(citationRegex);

  let citation: { documentName: string; pageNumber: number } | undefined;
  let content = responseText;

  if (match) {
    const documentName = match[1].trim();
    const pageNumber = parseInt(match[2], 10);

    citation = {
      documentName,
      pageNumber
    };

    // Remove the citation from the main content
    content = responseText.replace(citationRegex, '').trim();
  }

  return {
    content,
    citation
  };
}
