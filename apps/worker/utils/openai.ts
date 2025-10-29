// apps/worker/utils/openai.ts
import OpenAI from 'openai';

// Lazy initialization of OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set in environment variables');
    }
    openaiClient = new OpenAI({ apiKey });
  }
  return openaiClient;
}

/**
 * Generate a summary of the call transcript using GPT-4
 */
export async function generateCallSummary(transcript: any): Promise<string> {
  try {
    const openai = getOpenAIClient();
    // Convert transcript to a readable format
    let transcriptText = '';
    
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (Array.isArray(transcript)) {
      // If transcript is an array of messages
      transcriptText = transcript
        .map((msg: any) => `${msg.role || msg.speaker}: ${msg.content || msg.text}`)
        .join('\n');
    } else if (transcript.messages) {
      // If transcript has a messages array
      transcriptText = transcript.messages
        .map((msg: any) => `${msg.role || msg.speaker}: ${msg.content || msg.text}`)
        .join('\n');
    } else {
      // Fallback to JSON string
      transcriptText = JSON.stringify(transcript);
    }

    console.log('Generating summary for transcript...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: `You are a professional call analyst. Summarize the following call transcript in a clear, concise manner. Include:
- Main purpose of the call
- Key discussion points
- Action items or outcomes
- Overall sentiment

Keep the summary to 3-5 sentences.`
        },
        {
          role: 'user',
          content: transcriptText
        }
      ],
      temperature: 0.3,
      max_tokens: 300,
    });

    const summary = response.choices[0]?.message?.content || 'No summary generated';
    console.log('Summary generated successfully');
    return summary;

  } catch (error) {
    console.error('Error generating call summary:', error);
    throw new Error(`Failed to generate summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Generate an embedding vector for the given text using OpenAI's embedding model
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  try {
    const openai = getOpenAIClient();
    console.log('Generating embedding...');

    const response = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
      encoding_format: 'float',
    });

    const embedding = response.data[0].embedding;
    console.log(`Embedding generated: ${embedding.length} dimensions`);
    return embedding;

  } catch (error) {
    console.error('Error generating embedding:', error);
    throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Detect if a callback is needed and extract timing information
 */
export async function detectCallbackNeeded(transcript: any): Promise<{
  needed: boolean;
  reason?: string;
  requestedTime?: string; // Natural language time request
  suggestedDateTime?: Date; // Parsed datetime or default +2 hours
}> {
  try {
    const openai = getOpenAIClient();
    // Convert transcript to readable format (same as in generateCallSummary)
    let transcriptText = '';
    
    if (typeof transcript === 'string') {
      transcriptText = transcript;
    } else if (Array.isArray(transcript)) {
      transcriptText = transcript
        .map((msg: any) => `${msg.role || msg.speaker}: ${msg.content || msg.text}`)
        .join('\n');
    } else if (transcript.messages) {
      transcriptText = transcript.messages
        .map((msg: any) => `${msg.role || msg.speaker}: ${msg.content || msg.text}`)
        .join('\n');
    } else {
      transcriptText = JSON.stringify(transcript);
    }

    console.log('Detecting if callback is needed and extracting timing...');

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Analyze this call transcript and determine if a follow-up callback is needed and extract timing information.

A callback is needed if:
- The customer explicitly requested a callback
- The issue wasn't resolved and requires follow-up
- More information is needed
- A follow-up was promised
- Customer wants to be contacted later

For timing, look for:
- Specific times: "call me at 2 PM", "tomorrow at 10 AM", "next Monday at 9"
- Relative times: "tomorrow", "next week", "in 2 hours", "later today"
- General requests: "call me back", "contact me later" (no specific time)

Current time context: ${new Date().toISOString()}

Respond with a JSON object:
{
  "needed": true/false,
  "reason": "explanation of why callback is needed",
  "requestedTime": "exact quote of customer's time request or null if no specific time mentioned",
  "timing": "specific_time|relative_time|general_request|none"
}`
        },
        {
          role: 'user',
          content: transcriptText
        }
      ],
      temperature: 0.2,
      max_tokens: 200,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{"needed": false}');
    console.log('Callback detection result:', result);

    // Calculate suggested datetime
    let suggestedDateTime: Date | undefined;
    
    if (result.needed) {
      if (result.requestedTime && result.timing !== 'none') {
        // Try to parse the time with OpenAI
        const parsedTime = await parseTimeWithAI(result.requestedTime);
        if (parsedTime) {
          suggestedDateTime = parsedTime;
        }
      }
      
      // If no specific time or parsing failed, default to 2 hours from now
      if (!suggestedDateTime) {
        suggestedDateTime = new Date(Date.now() + 2 * 60 * 60 * 1000); // +2 hours
        console.log('No specific time found, defaulting to +2 hours:', suggestedDateTime);
      }
    }

    return {
      needed: result.needed,
      reason: result.reason,
      requestedTime: result.requestedTime,
      suggestedDateTime
    };

  } catch (error) {
    console.error('Error detecting callback need:', error);
    // Default to no callback on error
    return { needed: false };
  }
}

/**
 * Parse natural language time using AI
 */
async function parseTimeWithAI(timeRequest: string): Promise<Date | null> {
  try {
    const openai = getOpenAIClient();
    const currentTime = new Date().toISOString();
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Convert natural language time requests to ISO datetime format.

Current time: ${currentTime}
Current timezone: User's local timezone (assume same as current)

Examples:
- "tomorrow at 2 PM" → 2025-10-19T14:00:00.000Z
- "next Monday at 9 AM" → 2025-10-21T09:00:00.000Z
- "in 3 hours" → add 3 hours to current time
- "later today at 5" → today at 5 PM

Respond with JSON:
{
  "datetime": "ISO string" or null if cannot parse,
  "confidence": "high|medium|low"
}`
        },
        {
          role: 'user',
          content: `Parse this time request: "${timeRequest}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 100,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    
    if (result.datetime && result.confidence !== 'low') {
      const parsedDate = new Date(result.datetime);
      
      // Validate the date is in the future and reasonable (within 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (parsedDate > now && parsedDate <= thirtyDaysFromNow) {
        console.log(`✅ Parsed time: "${timeRequest}" → ${parsedDate.toISOString()}`);
        return parsedDate;
      }
    }
    
    console.log(`⚠️ Could not parse time: "${timeRequest}"`);
    return null;
    
  } catch (error) {
    console.error('Error parsing time with AI:', error);
    return null;
  }
}

/**
 * Parse callback time from ElevenLabs Final_callback_time field
 * This is a simpler version that handles common formats
 */
export async function parseCallbackTime(timeString: string | null | undefined): Promise<Date | null> {
  if (!timeString || timeString === 'null' || timeString.trim() === '') {
    return null;
  }

  try {
    // First try to parse as ISO date
    const isoDate = new Date(timeString);
    if (!isNaN(isoDate.getTime()) && isoDate > new Date()) {
      return isoDate;
    }

    // If that fails, use AI to parse natural language
    return await parseTimeWithAI(timeString);
  } catch (error) {
    console.error('Error parsing callback time:', error);
    return null;
  }
}
