import { AIProvider, AIProviderConfig, PDFFile, AIResponse } from '../../types/index.ts';
import { constructAIPrompt, parseAIResponse } from './promptUtils.ts';

export const openaiConfig: AIProviderConfig = {
  name: 'OpenAI GPT',
  apiUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-4o-mini-2024-07-18', // Updated to a valid model name
  maxTokens: 120000,
  temperature: 1
};

/**
 * OpenAI API implementation
 */
async function callOpenAIAPI(question: string, pdfFiles: PDFFile[], apiKey: string): Promise<AIResponse> {
  const prompt = constructAIPrompt(question, pdfFiles);

  try {
    const response = await fetch(openaiConfig.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: openaiConfig.model,
        messages: [
          {
            role: 'system',
            content: 'You are a knowledgeable AI assistant and expert document analyst. You help users by analyzing PDF documents, but you can also answer general questions using your broad knowledge base. If you use provided documents, provide citations in the exact format: "Source: [Document Name], Page X"'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: openaiConfig.maxTokens,
        temperature: openaiConfig.temperature
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;
      throw new Error(`OpenAI API error: ${errorMessage}`);
    }

    const data = await response.json();
    const aiResponseText = data.choices?.[0]?.message?.content;

    if (!aiResponseText) {
      throw new Error('No response content from OpenAI API');
    }

    return parseAIResponse(aiResponseText);
  } catch (error) {
    if (error instanceof Error) {
      // Provide more specific error messages
      if (error.message.includes('401')) {
        throw new Error('Invalid OpenAI API key. Please check your VITE_OPENAI_API_KEY in the .env file.');
      } else if (error.message.includes('429')) {
        throw new Error('OpenAI API rate limit exceeded. Please try again in a moment.');
      } else if (error.message.includes('quota')) {
        throw new Error('OpenAI API quota exceeded. Please check your account billing.');
      }
    }
    throw error;
  }
}

export const openaiProvider: AIProvider = {
  type: 'openai',
  config: openaiConfig,
  callAPI: callOpenAIAPI
};