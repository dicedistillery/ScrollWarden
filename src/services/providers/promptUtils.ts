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

interface DocumentChunk {
  documentName: string;
  pageNumber: number;
  text: string;
  score: number;
}

const MAX_CONTEXT_CHARS = 60000;
const MAX_PAGE_CHARS = 12000;
const STOP_WORDS = new Set(['about', 'after', 'again', 'also', 'could', 'from', 'have', 'into', 'more', 'that', 'their', 'there', 'these', 'they', 'this', 'what', 'when', 'where', 'which', 'with', 'would', 'your']);

/** Selects question-relevant pages instead of always sending the beginning of a document. */
export function selectRelevantDocumentContext(question: string, pdfFiles: PDFFile[]): string {
  const terms = Array.from(new Set(
    sanitizeUserInput(question).toLocaleLowerCase().match(/[\p{L}\p{N}]{3,}/gu) ?? []
  )).filter(term => !STOP_WORDS.has(term));
  const chunks: DocumentChunk[] = [];

  pdfFiles.forEach(pdf => {
    const matches = Array.from(pdf.extractedText.matchAll(/\[Page\s+(\d+)\]\s*([\s\S]*?)(?=\[Page\s+\d+\]|$)/gi));
    const pages = matches.length > 0
      ? matches.map(match => ({ pageNumber: Number(match[1]), text: match[2].trim() }))
      : [{ pageNumber: 1, text: pdf.extractedText }];

    pages.forEach(page => {
      const normalized = page.text.toLocaleLowerCase();
      const score = terms.reduce((total, term) => {
        let occurrences = 0;
        let offset = normalized.indexOf(term);
        while (offset !== -1 && occurrences < 20) {
          occurrences++;
          offset = normalized.indexOf(term, offset + term.length);
        }
        return total + occurrences;
      }, 0);
      chunks.push({ documentName: pdf.name, pageNumber: page.pageNumber, text: page.text, score });
    });
  });

  chunks.sort((a, b) => b.score - a.score || a.pageNumber - b.pageNumber);
  // When no lexical match exists, sample from across each document rather than
  // silently restricting the model to its opening pages.
  const candidates = chunks.some(chunk => chunk.score > 0)
    ? chunks
    : pdfFiles.flatMap(pdf => {
        const own = chunks.filter(chunk => chunk.documentName === pdf.name);
        return own.filter((_, index) => index === 0 || index === own.length - 1 || index % Math.max(1, Math.floor(own.length / 4)) === 0);
      });

  let used = 0;
  const selected: string[] = [];
  for (const chunk of candidates) {
    const safeText = chunk.text.slice(0, MAX_PAGE_CHARS);
    const block = `Document: ${sanitizeText(chunk.documentName)} | Page ${chunk.pageNumber}\n${safeText}\n`;
    if (used + block.length > MAX_CONTEXT_CHARS) continue;
    selected.push(block);
    used += block.length;
    if (used >= MAX_CONTEXT_CHARS * 0.9) break;
  }
  return selected.join('\n');
}

/**
 * Constructs a detailed prompt for AI providers to answer questions based on PDF content
 * This shared implementation ensures consistency across all providers
 */
export function constructAIPrompt(question: string, pdfFiles: PDFFile[]): string {
  // Sanitize the question
  const sanitizedQuestion = sanitizeUserInput(question);

  const documentTexts = selectRelevantDocumentContext(sanitizedQuestion, pdfFiles);

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
  const citationRegex = /Source:\s*(?:\[([^\]]+)\]|(.+)),\s*Page\s*(\d+)/i;
  const match = responseText.match(citationRegex);

  let citation: { documentName: string; pageNumber: number } | undefined;
  let content = responseText;

  if (match) {
    const documentName = (match[1] || match[2]).trim();
    const pageNumber = parseInt(match[3], 10);

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
