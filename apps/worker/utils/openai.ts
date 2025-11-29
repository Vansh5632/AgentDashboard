// apps/worker/utils/openai.ts
import OpenAI from 'openai';

// Singapore timezone constants for transcript analysis
const SINGAPORE_TIMEZONE = 'Asia/Singapore';
const SINGAPORE_UTC_OFFSET = 8; // +8:00 hours

/**
 * Get current time in Singapore timezone (for transcript context)
 */
function getNowInSingapore(): Date {
  const now = new Date();
  // Create a new date representing the same moment in Singapore timezone
  const singapore = new Date(now.toLocaleString("en-US", {timeZone: SINGAPORE_TIMEZONE}));
  return singapore;
}

/**
 * Convert a Date to Singapore timezone string for display
 */
function toSingaporeTimeString(date: Date): string {
  return date.toLocaleString("en-US", {
    timeZone: SINGAPORE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }) + ' SGT';
}

/**
 * Convert Singapore time to UTC for storage
 * Input: Date object representing time in Singapore context
 * Output: Date object in UTC
 */
function singaporeToUTC(singaporeDate: Date): Date {
  // Get the time components as if they were in Singapore
  const year = singaporeDate.getFullYear();
  const month = singaporeDate.getMonth();
  const date = singaporeDate.getDate();
  const hours = singaporeDate.getHours();
  const minutes = singaporeDate.getMinutes();
  const seconds = singaporeDate.getSeconds();
  
  // Create a new date in UTC representing the same calendar time
  // but interpret it as being in Singapore timezone
  const utcDate = new Date(Date.UTC(year, month, date, hours, minutes, seconds));
  
  // Subtract 8 hours to convert from SGT to UTC
  utcDate.setUTCHours(utcDate.getUTCHours() - SINGAPORE_UTC_OFFSET);
  
  return utcDate;
}

/**
 * Convert UTC time to Singapore time for display
 */
function utcToSingapore(utcDate: Date): Date {
  // Add 8 hours to UTC to get Singapore time
  return new Date(utcDate.getTime() + (SINGAPORE_UTC_OFFSET * 60 * 60 * 1000));
}

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
      // Handle ElevenLabs transcript format with 'message' field
      transcriptText = transcript
        .map((msg: any) => {
          const speaker = msg.role === 'agent' ? 'Agent' : 'Customer';
          const content = msg.message || msg.content || msg.text || '';
          return `${speaker}: ${content}`;
        })
        .join('\n');
    } else if (transcript.messages) {
      // If transcript has a messages array
      transcriptText = transcript.messages
        .map((msg: any) => {
          const speaker = msg.role === 'agent' ? 'Agent' : 'Customer';
          const content = msg.message || msg.content || msg.text || '';
          return `${speaker}: ${content}`;
        })
        .join('\n');
    } else {
      // Fallback to JSON string
      transcriptText = JSON.stringify(transcript);
    }

    console.log('Generating summary for transcript...');
    console.log('Transcript text preview:', transcriptText.substring(0, 200) + '...');

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
      // Handle ElevenLabs transcript format with 'message' field
      transcriptText = transcript
        .map((msg: any) => {
          const speaker = msg.role === 'agent' ? 'Agent' : 'Customer';
          const content = msg.message || msg.content || msg.text || '';
          return `${speaker}: ${content}`;
        })
        .join('\n');
    } else if (transcript.messages) {
      transcriptText = transcript.messages
        .map((msg: any) => {
          const speaker = msg.role === 'agent' ? 'Agent' : 'Customer';
          const content = msg.message || msg.content || msg.text || '';
          return `${speaker}: ${content}`;
        })
        .join('\n');
    } else {
      transcriptText = JSON.stringify(transcript);
    }

    console.log('Detecting if callback is needed and extracting timing...');
    console.log('Transcript text for analysis:', transcriptText.substring(0, 300) + '...');

    const currentSingaporeTime = getNowInSingapore();
    const singaporeTimeString = toSingaporeTimeString(currentSingaporeTime);

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
- Relative times: "tomorrow", "next week", "in 2 hours", "later today", "in 5 minutes"
- General requests: "call me back", "contact me later" (no specific time)

IMPORTANT: The transcript contains times spoken in Singapore timezone (SGT, UTC+8).
Current Singapore time: ${singaporeTimeString}
Current time context: ${currentSingaporeTime.toISOString()}

When customers say times like "2 PM" or "tomorrow at 9 AM", they mean Singapore time.

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
    const currentSingaporeTime = getNowInSingapore();
    const singaporeTimeString = toSingaporeTimeString(currentSingaporeTime);
    
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `Convert natural language time requests to ISO datetime format.

CONTEXT: The time request comes from a customer speaking in Singapore timezone (SGT, UTC+8).
Current Singapore time: ${singaporeTimeString}

For RELATIVE times like "5 minutes", "2 hours", "30 mins":
- Add the duration to the current Singapore time
- Example: if current SGT time is 2025-11-10T10:30:00+08:00 and request is "5 minutes", calculate 2025-11-10T10:35:00+08:00

For ABSOLUTE times like "tomorrow at 2 PM", "next Monday at 9 AM":
- Customer means Singapore time
- Example: "tomorrow at 2 PM" = tomorrow 2 PM SGT

CRITICAL: Always interpret times as Singapore timezone (SGT, UTC+8) since that's what customers are speaking in.

Examples (assuming current SGT time is 2025-11-10T10:30:00+08:00):
- "5 minutes" → 2025-11-10T10:35:00+08:00 (current SGT + 5 mins)
- "in 2 hours" → 2025-11-10T12:30:00+08:00 (current SGT + 2 hours)
- "tomorrow at 2 PM" → 2025-11-11T14:00:00+08:00 (tomorrow 2 PM SGT)

Respond with JSON:
{
  "datetime": "ISO string with +08:00 timezone" or null if cannot parse,
  "confidence": "high|medium|low",
  "calculation": "description of how you calculated the time in Singapore timezone"
}`
        },
        {
          role: 'user',
          content: `Parse this time request from Singapore timezone context: "${timeRequest}"`
        }
      ],
      temperature: 0.1,
      max_tokens: 150,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(response.choices[0]?.message?.content || '{}');
    console.log('🤖 AI Time Parsing Result (SGT context):', result);
    
    if (result.datetime && result.confidence !== 'low') {
      let parsedDate = new Date(result.datetime);
      
      // If the AI returned a time without timezone info, assume it's Singapore time
      if (!result.datetime.includes('+') && !result.datetime.includes('Z')) {
        console.log('⚠️  AI returned time without timezone, treating as Singapore time');
        // Create a new date in Singapore timezone
        const sgTime = new Date(result.datetime);
        parsedDate = singaporeToUTC(sgTime);
      }
      // If AI returned ISO string with timezone (+08:00 or Z), Date constructor already converted to UTC
      // No additional conversion needed!
      
      // Validate the date is in the future and reasonable (within 30 days)
      const now = new Date();
      const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      if (parsedDate > now && parsedDate <= thirtyDaysFromNow) {
        console.log(`✅ Parsed time: "${timeRequest}" → ${parsedDate.toISOString()} (was SGT: ${toSingaporeTimeString(utcToSingapore(parsedDate))})`);
        return parsedDate;
      } else {
        console.log(`⚠️ Parsed date is out of reasonable range: ${parsedDate.toISOString()}`);
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
    console.log('⚠️ parseCallbackTime: No valid time string provided');
    return null;
  }

  const cleanedTimeString = timeString.trim();
  console.log(`🕐 parseCallbackTime called with: "${cleanedTimeString}"`);

  try {
    // First try to parse as ISO date
    console.log(`🔍 Step 1: Checking if ISO date format...`);
    if (cleanedTimeString.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/) || cleanedTimeString.includes('T')) {
      const isoDate = new Date(cleanedTimeString);
      if (!isNaN(isoDate.getTime()) && isoDate > new Date()) {
        // Check if it's already in UTC (ends with Z)
        if (cleanedTimeString.endsWith('Z')) {
          console.log(`✅ parseCallbackTime: Parsed as UTC ISO date: ${isoDate.toISOString()}`);
          return isoDate;
        }
        // Check if it has Singapore timezone (+08:00)
        else if (cleanedTimeString.includes('+08:00')) {
          // The parsed date is already correct, but we need to adjust for the timezone interpretation
          // Since it's +08:00, subtract 8 hours to get UTC
          const utcDate = new Date(isoDate.getTime() - 8 * 60 * 60 * 1000);
          console.log(`✅ parseCallbackTime: Parsed SGT ISO date, converted to UTC: ${utcDate.toISOString()}`);
          return utcDate;
        }
        // Other timezone or no timezone specified
        else {
          console.log(`✅ parseCallbackTime: Parsed as ISO date: ${isoDate.toISOString()}`);
          return isoDate;
        }
      } else {
        console.log(`⚠️ ISO date parse resulted in invalid or past date`);
      }
    } else {
      console.log(`ℹ️ Not an ISO date format, trying regex patterns...`);
    }

    console.log(`🔍 Step 2: Trying regex parsing for: "${cleanedTimeString}"`);
    
    // Try simple regex patterns first (faster and more reliable for relative times)
    const simpleTime = parseSimpleTimePatterns(cleanedTimeString);
    if (simpleTime) {
      console.log(`✅ parseCallbackTime: Successfully parsed with regex: ${simpleTime.toISOString()}`);
      return simpleTime;
    }

    console.log(`🔍 Step 3: Regex failed, trying AI parsing for: "${cleanedTimeString}"`);
    
    // Only use AI for complex time expressions that regex can't handle
    const aiParsed = await parseTimeWithAI(cleanedTimeString);
    if (aiParsed) {
      console.log(`✅ parseCallbackTime: AI successfully parsed: ${aiParsed.toISOString()}`);
    } else {
      console.log(`❌ parseCallbackTime: ALL parsing methods failed for: "${cleanedTimeString}"`);
    }
    return aiParsed;
  } catch (error) {
    console.error('Error parsing callback time:', error);
    return null;
  }
}

/**
 * Parse simple time patterns using regex (faster than AI for common cases)
 * Input times are in SGT context, output is converted to UTC for storage
 */
function parseSimpleTimePatterns(timeString: string): Date | null {
  const singaporeNow = getNowInSingapore(); // Current time in SGT context
  const lowerTime = timeString.toLowerCase().trim();
  
  console.log(`🕐 parseSimpleTimePatterns: Current Singapore time: ${toSingaporeTimeString(singaporeNow)}`);
  
  // Pattern 1: Time with SGT timezone - "18:21 SGT", "06:21 PM SGT", "2025-11-29 18:21 SGT", "2025-11-29 06:21 PM SGT"
  const sgtTimeMatch = timeString.match(/(\d{4}-\d{2}-\d{2})?[\s\-]*(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(am|pm|AM|PM)?\s*(?:SGT|sgt)?/i);
  if (sgtTimeMatch) {
    const dateStr = sgtTimeMatch[1]; // Optional date
    let hours = parseInt(sgtTimeMatch[2]);
    const minutes = parseInt(sgtTimeMatch[3]);
    const seconds = sgtTimeMatch[4] ? parseInt(sgtTimeMatch[4]) : 0;
    const ampm = sgtTimeMatch[5]?.toLowerCase();
    
    // Convert 12-hour to 24-hour format
    if (ampm === 'pm' && hours !== 12) {
      hours += 12;
    } else if (ampm === 'am' && hours === 12) {
      hours = 0;
    }
    
    console.log(`🕐 Matched SGT time format: ${hours}:${minutes}:${seconds} ${ampm || '24h'}`);
    
    // Create date in Singapore timezone
    let targetSGT = new Date(singaporeNow);
    
    if (dateStr) {
      // Specific date provided
      const [year, month, day] = dateStr.split('-').map(Number);
      targetSGT = new Date(year, month - 1, day, hours, minutes, seconds);
      console.log(`📅 Using provided date: ${dateStr}`);
    } else {
      // Today's date with specified time
      targetSGT.setHours(hours, minutes, seconds, 0);
      
      // If the time is in the past, assume it's tomorrow
      if (targetSGT <= singaporeNow) {
        targetSGT.setDate(targetSGT.getDate() + 1);
        console.log(`⏭️ Time is in past, using tomorrow`);
      }
    }
    
    console.log(`📅 Target SGT time: ${toSingaporeTimeString(targetSGT)}`);
    
    // Convert to UTC
    const utcTime = singaporeToUTC(targetSGT);
    console.log(`🌐 Converted to UTC: ${utcTime.toISOString()}`);
    return utcTime;
  }
  
  // Pattern 2: Relative time - "5 minutes", "30 mins", "2 hours", "in 5 minutes", etc.
  const relativeMatch = lowerTime.match(/(\d+)\s*(minute|minutes|mins?|hour|hours?)/i);
  if (relativeMatch) {
    const amount = parseInt(relativeMatch[1]);
    const unit = relativeMatch[2].toLowerCase();
    
    console.log(`🔍 Regex match: amount=${amount}, unit=${unit}`);
    
    // Calculate future time in Singapore timezone
    let futureSingaporeTime = new Date(singaporeNow);
    
    if (unit.startsWith('min')) {
      futureSingaporeTime.setMinutes(futureSingaporeTime.getMinutes() + amount);
      console.log(`📅 Regex: "${timeString}" → +${amount} minutes in SGT → ${toSingaporeTimeString(futureSingaporeTime)}`);
    } else if (unit.startsWith('hour')) {
      futureSingaporeTime.setHours(futureSingaporeTime.getHours() + amount);
      console.log(`📅 Regex: "${timeString}" → +${amount} hours in SGT → ${toSingaporeTimeString(futureSingaporeTime)}`);
    }
    
    // Convert Singapore time to UTC for storage
    const futureUTCTime = singaporeToUTC(futureSingaporeTime);
    console.log(`🌐 Converted to UTC: ${futureUTCTime.toISOString()}`);
    return futureUTCTime;
  }
  
  // Pattern 3: "tomorrow", "next week", etc.
  if (lowerTime.includes('tomorrow')) {
    // Create tomorrow in Singapore timezone
    const tomorrow = new Date(singaporeNow);
    tomorrow.setDate(tomorrow.getDate() + 1);
    
    // Check if specific time is mentioned (like "2 PM", "9 AM", etc.)
    const timeMatch = lowerTime.match(/(\d{1,2})\s*(am|pm|AM|PM)/);
    if (timeMatch) {
      let hour = parseInt(timeMatch[1]);
      const ampm = timeMatch[2].toLowerCase();
      
      // Convert to 24-hour format
      if (ampm === 'pm' && hour !== 12) {
        hour += 12;
      } else if (ampm === 'am' && hour === 12) {
        hour = 0;
      }
      
      tomorrow.setHours(hour, 0, 0, 0);
      console.log(`📅 Regex: "${timeString}" → tomorrow ${timeMatch[0]} SGT → ${toSingaporeTimeString(tomorrow)}`);
    } else {
      // Default to 10 AM Singapore time if no specific time mentioned
      tomorrow.setHours(10, 0, 0, 0);
      console.log(`📅 Regex: "${timeString}" → tomorrow 10 AM SGT (default) → ${toSingaporeTimeString(tomorrow)}`);
    }
    
    // Convert Singapore time to UTC for storage
    const tomorrowUTC = singaporeToUTC(tomorrow);
    console.log(`🌐 Converted to UTC: ${tomorrowUTC.toISOString()}`);
    return tomorrowUTC;
  }
  
  return null;
}
