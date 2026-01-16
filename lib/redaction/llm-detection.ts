import type { EntityType, DetectedEntity } from '@/types/redaction';
import { generateMaskedValue, ENTITY_CONFIG } from './patterns';

const CASEDEV_API_URL = process.env.CASEDEV_API_URL || 'https://api.case.dev';
const CASEDEV_API_KEY = process.env.CASEDEV_API_KEY;

// Memory limits - increased with 16GB heap
const MAX_CHUNK_SIZE = 3000; // Chunk size for LLM processing
const MAX_TEXT_SIZE = 60000; // Max text for LLM processing (60KB)
const LARGE_TEXT_THRESHOLD = 40000; // Above this, skip retrospective
const CHUNK_OVERLAP = 100; // Overlap between chunks
const MAX_ENTITIES = 300; // Entity limit
const SKIP_CONTEXT_STORAGE = true; // Don't store context during detection to save memory

// Token usage tracking
export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

export interface LLMDetectionResult {
  entities: DetectedEntity[];
  usage: TokenUsage;
}

// Generate unique ID
function generateId(): string {
  return crypto.randomUUID();
}

// Split text into manageable chunks with overlap
function chunkText(text: string, chunkSize: number = MAX_CHUNK_SIZE, overlap: number = CHUNK_OVERLAP): { chunk: string; offset: number }[] {
  if (text.length <= chunkSize) {
    return [{ chunk: text, offset: 0 }];
  }

  const chunks: { chunk: string; offset: number }[] = [];
  let position = 0;

  while (position < text.length) {
    // Find a good break point (end of sentence or paragraph)
    let endPos = Math.min(position + chunkSize, text.length);

    if (endPos < text.length) {
      // Try to break at paragraph
      const paragraphBreak = text.lastIndexOf('\n\n', endPos);
      if (paragraphBreak > position + chunkSize / 2) {
        endPos = paragraphBreak + 2;
      } else {
        // Try to break at sentence
        const sentenceBreak = text.lastIndexOf('. ', endPos);
        if (sentenceBreak > position + chunkSize / 2) {
          endPos = sentenceBreak + 2;
        }
      }
    }

    chunks.push({
      chunk: text.slice(position, endPos),
      offset: position,
    });

    // Move position, accounting for overlap
    position = endPos - overlap;
    if (position >= text.length - overlap) break;
  }

  return chunks;
}

// Build category-specific guidance for the LLM
function buildCategoryGuidance(entityTypes: EntityType[]): string {
  const guidance: string[] = [];

  for (const type of entityTypes) {
    const config = ENTITY_CONFIG[type];
    switch (type) {
      case 'name':
        guidance.push(`- NAMES: Extract FULL names including middle names. "wife Maria Elena Rodriguez" → "Maria Elena Rodriguez". "son Juan Carlos" → "Juan Carlos". Include ALL name parts after relationship words (wife, husband, son, daughter, brother, sister, client, patient).`);
        break;
      case 'employer':
        guidance.push(`- EMPLOYERS/ORGS: "Chase Bank", "Phoenix General Hospital", "City University", "Acme Corporation". Include after "at", "from", "Bank:", "Hospital:".`);
        break;
      case 'financial_amount':
        guidance.push(`- MONEY: "$7,500.00", "$475,000", "12,500 dollars". Extract the amount with $ sign.`);
        break;
      case 'account_number':
        guidance.push(`- IDs/NUMBERS: "PGH-4821", "#1847", "****4821", "Check #1234", "Employee ID: ABC-123". Extract the ID/number.`);
        break;
      case 'ssn':
        guidance.push(`- SSN: "123-45-6789", "123 45 6789". Nine digit numbers with dashes/spaces.`);
        break;
      case 'phone':
        guidance.push(`- PHONE: "(555) 123-4567", "555-123-4567". Ten digit phone numbers.`);
        break;
      case 'email':
        guidance.push(`- EMAIL: "john@example.com". Addresses with @ symbol.`);
        break;
      case 'address':
        guidance.push(`- ADDRESS: "123 Main Street", "456 Oak Ave #5". Street addresses with numbers.`);
        break;
      case 'date_of_birth':
        guidance.push(`- DATES: "01/15/1990", "March 15, 1985", "November 8, 2024".`);
        break;
      case 'credit_card':
        guidance.push(`- CARDS: "4111-1111-1111-1111". 13-19 digit card numbers.`);
        break;
      default:
        if (config) {
          guidance.push(`- ${config.label}: ${config.description}`);
        }
    }
  }

  return guidance.join('\n');
}

// Build prompt for PII detection
function buildDetectionPrompt(text: string, entityTypes: EntityType[]): string {
  const categoryGuidance = buildCategoryGuidance(entityTypes);
  const validTypes = entityTypes.filter(t => t !== 'custom').join('|');

  return `Find ALL sensitive information, especially in NARRATIVE TEXT.

CRITICAL - NAMES IN NARRATIVES:
- Extract FULL names (first + middle + last) after relationship words
- "wife Maria Elena Rodriguez" → "Maria Elena Rodriguez" (full name, not just "Maria")
- "son Michael James" → "Michael James"
- "daughter Sarah" → "Sarah" (single name if that's all there is)
- "Client John Smith and his wife Anna Marie Johnson" → "John Smith" AND "Anna Marie Johnson"

CRITICAL - OTHER ENTITIES:
- ORGANIZATIONS: "at Phoenix General Hospital", "from Chase Bank" → full org name
- IDs/NUMBERS: "Employee ID: PGH-4821", "Check #1847" → the ID/number only
- AMOUNTS: "$7,500.00" → the dollar amount

DO NOT REDACT labels like "Spouse Name:", "Account Number:"

EXAMPLES:
- "wife Maria Elena Rodriguez (née Vasquez)" → {"value": "Maria Elena Rodriguez", "type": "name"} AND {"value": "Vasquez", "type": "name"}
- "his brother Juan Carlos Martinez" → {"value": "Juan Carlos Martinez", "type": "name"}
- "Client's wife Elena works at Phoenix General Hospital" → "Elena" AND "Phoenix General Hospital"
- "Employee ID: PGH-4821" → {"value": "PGH-4821", "type": "account_number"}

CATEGORIES:
${categoryGuidance}

Return EXACT text. JSON only:
{"entities":[{"value":"text","type":"${validTypes}","confidence":0.9}]}

TEXT:
${text}`;
}

// Process a single text chunk with LLM
async function detectChunk(
  chunk: string,
  offset: number,
  entityTypes: EntityType[],
  fullText: string
): Promise<LLMDetectionResult> {
  const emptyResult: LLMDetectionResult = { entities: [], usage: { inputTokens: 0, outputTokens: 0 } };

  try {
    const prompt = buildDetectionPrompt(chunk, entityTypes);

    const response = await fetch(`${CASEDEV_API_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CASEDEV_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You are a sensitive data detection expert. Find sensitive VALUES (names, amounts, SSNs) - NOT field labels. Respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      console.error('LLM chunk detection failed:', await response.text());
      return emptyResult;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    const usage: TokenUsage = {
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
    };

    if (!content) {
      return { entities: [], usage };
    }

    let parsed;
    try {
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(jsonContent);
    } catch {
      return { entities: [], usage };
    }

    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      return { entities: [], usage };
    }

    const entities: DetectedEntity[] = [];

    for (const item of parsed.entities) {
      if (!item.value || !item.type) continue;
      if (!entityTypes.includes(item.type as EntityType)) continue;

      // Find position in chunk first
      const chunkIndex = chunk.indexOf(item.value);
      if (chunkIndex === -1) continue;

      // Calculate actual position in full text
      const startIndex = offset + chunkIndex;

      // Verify the value exists at this position in the full text
      if (fullText.slice(startIndex, startIndex + item.value.length) !== item.value) {
        // Try to find it in the full text near this position
        const searchStart = Math.max(0, startIndex - 100);
        const searchEnd = Math.min(fullText.length, startIndex + item.value.length + 100);
        const searchArea = fullText.slice(searchStart, searchEnd);
        const foundIndex = searchArea.indexOf(item.value);
        if (foundIndex === -1) continue;
        // Adjust startIndex
        const adjustedStart = searchStart + foundIndex;
        entities.push({
          id: generateId(),
          type: item.type as EntityType,
          value: item.value,
          maskedValue: generateMaskedValue(item.type as EntityType, item.value),
          confidence: Math.min(1, Math.max(0, item.confidence || 0.8)),
          method: 'llm',
          startIndex: adjustedStart,
          endIndex: adjustedStart + item.value.length,
          context: extractContext(fullText, adjustedStart, adjustedStart + item.value.length),
          shouldRedact: true,
        });
      } else {
        entities.push({
          id: generateId(),
          type: item.type as EntityType,
          value: item.value,
          maskedValue: generateMaskedValue(item.type as EntityType, item.value),
          confidence: Math.min(1, Math.max(0, item.confidence || 0.8)),
          method: 'llm',
          startIndex,
          endIndex: startIndex + item.value.length,
          context: extractContext(fullText, startIndex, startIndex + item.value.length),
          shouldRedact: true,
        });
      }
    }

    return { entities, usage };
  } catch (error) {
    console.error('LLM chunk detection error:', error);
    return emptyResult;
  }
}

// Detect PII using LLM with chunking for large texts
export async function detectWithLLM(
  text: string,
  entityTypes: EntityType[]
): Promise<LLMDetectionResult> {
  const emptyResult: LLMDetectionResult = { entities: [], usage: { inputTokens: 0, outputTokens: 0 } };

  if (!CASEDEV_API_KEY) {
    console.warn('CASEDEV_API_KEY not configured - skipping LLM detection');
    return emptyResult;
  }

  // Skip LLM for very large texts to prevent memory issues
  if (text.length > MAX_TEXT_SIZE) {
    console.warn(`Text too large for LLM detection (${text.length} chars > ${MAX_TEXT_SIZE}). Using regex only.`);
    return emptyResult;
  }

  try {
    // Chunk the text for processing
    const chunks = chunkText(text);
    const seen = new Map<string, DetectedEntity>();
    const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

    // Process chunks sequentially to avoid memory spikes
    for (const { chunk, offset } of chunks) {
      // Stop if we've hit entity limit
      if (seen.size >= MAX_ENTITIES) {
        console.warn(`Entity limit reached (${MAX_ENTITIES}), stopping LLM detection`);
        break;
      }

      const result = await detectChunk(chunk, offset, entityTypes, text);
      totalUsage.inputTokens += result.usage.inputTokens;
      totalUsage.outputTokens += result.usage.outputTokens;

      // Add entities directly to dedup map to avoid growing array
      for (const entity of result.entities) {
        if (seen.size >= MAX_ENTITIES) break;
        const key = `${entity.startIndex}-${entity.value}`;
        if (!seen.has(key)) {
          seen.set(key, entity);
        }
      }
      // Clear chunk result to help GC
      result.entities.length = 0;
    }

    return {
      entities: Array.from(seen.values()),
      usage: totalUsage,
    };
  } catch (error) {
    console.error('LLM detection error:', error);
    return emptyResult;
  }
}

// Extract context around a match - only called when needed for display
function extractContext(text: string, startIndex: number, endIndex: number): string {
  if (SKIP_CONTEXT_STORAGE) return ''; // Skip during detection to save memory
  const contextStart = Math.max(0, startIndex - 20);
  const contextEnd = Math.min(text.length, endIndex + 20);
  return text.slice(contextStart, contextEnd);
}

// Compute context lazily for an entity (called after detection is complete)
export function computeEntityContext(entity: DetectedEntity, text: string): string {
  const contextStart = Math.max(0, entity.startIndex - 25);
  const contextEnd = Math.min(text.length, entity.endIndex + 25);
  return text.slice(contextStart, contextEnd);
}

// Verification result interface
export interface VerificationResult {
  entities: DetectedEntity[];
  filteredCount: number;
  usage: TokenUsage;
}

// Process a batch of entities for verification
async function verifyBatch(
  entitiesToVerify: { id: number; value: string; type: string; context: string }[]
): Promise<{ verifications: { id: number; keep: boolean }[]; usage: TokenUsage }> {
  const emptyResult = { verifications: [], usage: { inputTokens: 0, outputTokens: 0 } };

  // Use compact format - just ask for IDs to KEEP (actual data)
  const prompt = `Classify each item as LABEL or DATA.

LABEL (field names - DO NOT keep):
- "Married Spouse Name", "Marital Status", "Spouse Name", "Client Name"
- "Contact Information", "Personal Email", "Work Email", "Home Phone"
- "Home Address", "Mailing Address", "Physical Address"
- "Date of Birth", "DOB", "Birth Date"
- "Social Security", "Account Number", "Employee ID"
- Any text that describes WHAT data goes there, not the data itself

DATA (actual sensitive info - KEEP these):
- Actual names: "John Smith", "Elena Maria Rodriguez", "Michael"
- Actual emails: "john@example.com"
- Actual amounts: "$475,000", "$15,416"
- Actual addresses: "123 Main St, Phoenix AZ"
- Actual organizations: "Phoenix General Hospital"

Items to classify:
${entitiesToVerify.map(e => `[${e.id}] "${e.value}" | Context: "${e.context}"`).join('\n')}

Return IDs of actual DATA only: {"keep":[0,5,12]}`;

  try {
    const response = await fetch(`${CASEDEV_API_URL}/llm/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${CASEDEV_API_KEY}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'You classify text as LABEL or DATA. LABEL = field names like "Married Spouse Name", "Contact Information", "Home Address". DATA = actual info like "John Smith", "Elena Rodriguez", "$475,000". Return ONLY IDs of actual DATA: {"keep":[ids]}',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('Verification batch failed:', await response.text());
      return emptyResult;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    const usage: TokenUsage = {
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
    };

    if (!content) {
      return { verifications: [], usage };
    }

    // Parse the compact response
    let keepIds: number[] = [];
    try {
      const jsonContent = content.replace(/```json\n?/g, '').replace(/\n?```/g, '').trim();
      const parsed = JSON.parse(jsonContent);
      if (Array.isArray(parsed.keep)) {
        keepIds = parsed.keep;
      } else if (Array.isArray(parsed)) {
        keepIds = parsed;
      }
    } catch {
      // Try to extract array of numbers
      const match = content.match(/\[[\d,\s]*\]/);
      if (match) {
        try {
          keepIds = JSON.parse(match[0]);
        } catch {
          console.error('Failed to parse keep IDs:', content);
        }
      }
    }

    // Convert to verification format
    const keepSet = new Set(keepIds);
    const verifications = entitiesToVerify.map(e => ({
      id: e.id,
      keep: keepSet.has(e.id),
    }));

    return { verifications, usage };
  } catch (error) {
    console.error('Verification batch error:', error);
    return emptyResult;
  }
}

// Verify pattern-matched entities - filter out labels using AI
export async function verifyPatternMatches(
  entities: DetectedEntity[],
  text: string
): Promise<VerificationResult> {
  const emptyResult: VerificationResult = {
    entities: [...entities],
    filteredCount: 0,
    usage: { inputTokens: 0, outputTokens: 0 }
  };

  // Only verify regex/pattern matches - skip LLM-detected entities (they're already verified)
  const patternEntities = entities.filter(e => e.method === 'regex');
  const otherEntities = entities.filter(e => e.method !== 'regex');

  if (patternEntities.length === 0 || !CASEDEV_API_KEY) {
    return emptyResult;
  }

  // Build verification request with minimal context for each entity
  const entitiesToVerify = patternEntities.slice(0, MAX_ENTITIES).map((entity, index) => ({
    id: index,
    value: entity.value.slice(0, 100), // Truncate very long values
    type: entity.type,
    context: (entity.context || text.slice(
      Math.max(0, entity.startIndex - 20),
      Math.min(text.length, entity.endIndex + 20)
    )).slice(0, 80), // Truncate long contexts
  }));

  // Process in smaller batches for memory efficiency
  const BATCH_SIZE = 25;
  const allVerifications: { id: number; keep: boolean }[] = [];
  const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  for (let i = 0; i < entitiesToVerify.length; i += BATCH_SIZE) {
    const batch = entitiesToVerify.slice(i, i + BATCH_SIZE);
    const { verifications, usage } = await verifyBatch(batch);
    allVerifications.push(...verifications);
    totalUsage.inputTokens += usage.inputTokens;
    totalUsage.outputTokens += usage.outputTokens;
  }

  // Create a map of verification results
  const verificationMap = new Map<number, boolean>();
  for (const v of allVerifications) {
    verificationMap.set(v.id, v.keep);
  }

  // Filter pattern entities based on verification
  const verifiedPatternEntities = patternEntities.filter((_, index) => {
    const shouldKeep = verificationMap.get(index);
    // If verification says keep=true, keep it. If no result or keep=false, filter it out
    return shouldKeep === true;
  });

  const filteredCount = patternEntities.length - verifiedPatternEntities.length;

  // Combine verified pattern entities with other entities
  const allVerifiedEntities = [...verifiedPatternEntities, ...otherEntities];

  return {
    entities: allVerifiedEntities,
    filteredCount,
    usage: totalUsage,
  };
}

// Retrospective detection - second pass to catch missed items (uses chunking)
export async function detectRetrospective(
  text: string,
  existingEntities: DetectedEntity[],
  entityTypes: EntityType[]
): Promise<LLMDetectionResult> {
  const emptyResult: LLMDetectionResult = { entities: [], usage: { inputTokens: 0, outputTokens: 0 } };

  if (!CASEDEV_API_KEY) {
    return emptyResult;
  }

  // Skip retrospective for large texts to prevent memory issues
  if (text.length > LARGE_TEXT_THRESHOLD) {
    console.warn(`Text too large for retrospective detection (${text.length} chars > ${LARGE_TEXT_THRESHOLD}), skipping`);
    return emptyResult;
  }

  // Build list of already detected values (limit to save memory)
  const detectedValues = existingEntities.slice(0, 20).map(e => e.value.slice(0, 50));
  const validTypes = entityTypes.filter(t => t !== 'custom').join('|');

  // Process in smaller chunks for retrospective
  const chunks = chunkText(text, MAX_CHUNK_SIZE, 50);
  const seen = new Map<string, DetectedEntity>();
  const totalUsage: TokenUsage = { inputTokens: 0, outputTokens: 0 };

  for (const { chunk, offset } of chunks) {
    // Stop if we've hit entity limit
    if (seen.size >= MAX_ENTITIES / 2) {
      console.warn('Entity limit reached in retrospective, stopping');
      break;
    }

    const prompt = `SECOND PASS: Find sensitive info MISSED in this text.

Already found: ${detectedValues.slice(0, 10).join(', ')}

LOOK FOR FULL NAMES (include middle names):
- "wife Maria Elena Rodriguez" → "Maria Elena Rodriguez" (NOT just "Maria")
- "son Juan Carlos Martinez" → "Juan Carlos Martinez"
- "brother Michael James Smith" → "Michael James Smith"
- "daughter Sarah" → "Sarah" (if single name)

ALSO FIND:
- Employers: "works at Phoenix Hospital" → "Phoenix Hospital"
- IDs: "Employee ID: PGH-4821" → "PGH-4821"

DO NOT flag labels like "Spouse Name", "Contact Information".

Return: {"entities":[{"value":"text","type":"${validTypes}","confidence":0.85}]}

TEXT:
${chunk}`;

    try {
      const response = await fetch(`${CASEDEV_API_URL}/llm/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${CASEDEV_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'openai/gpt-4o',
          messages: [
            { role: 'system', content: 'Find missed sensitive VALUES. Return JSON only.' },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
          max_tokens: 1000, // Reduced from 2000
        }),
      });

      if (!response.ok) continue;

      const result = await response.json();
      const content = result.choices?.[0]?.message?.content;
      totalUsage.inputTokens += result.usage?.prompt_tokens || 0;
      totalUsage.outputTokens += result.usage?.completion_tokens || 0;

      if (!content) continue;

      let parsed;
      try {
        const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
        parsed = JSON.parse(jsonContent);
      } catch {
        continue;
      }

      if (!parsed.entities || !Array.isArray(parsed.entities)) continue;

      for (const item of parsed.entities) {
        if (seen.size >= MAX_ENTITIES / 2) break;
        if (!item.value || !item.type) continue;
        if (detectedValues.some(v => v === item.value.slice(0, 50))) continue;
        if (!entityTypes.includes(item.type as EntityType)) continue;

        const chunkIndex = chunk.indexOf(item.value);
        if (chunkIndex === -1) continue;

        const startIndex = offset + chunkIndex;
        if (text.slice(startIndex, startIndex + item.value.length) !== item.value) continue;

        const key = `${startIndex}-${item.value}`;
        if (!seen.has(key)) {
          seen.set(key, {
            id: crypto.randomUUID(),
            type: item.type as EntityType,
            value: item.value,
            maskedValue: generateMaskedValue(item.type as EntityType, item.value),
            confidence: Math.min(1, Math.max(0, (item.confidence || 0.75) * 0.9)),
            method: 'retrospective',
            startIndex,
            endIndex: startIndex + item.value.length,
            context: extractContext(text, startIndex, startIndex + item.value.length),
            shouldRedact: true,
          });
        }
      }
    } catch {
      continue;
    }
  }

  return { entities: Array.from(seen.values()), usage: totalUsage };
}

// ============================================================================
// FINAL SWEEP PASS - Find all occurrences of detected PII values
// ============================================================================

// Extract unique PII values and their components (e.g., split names into parts)
export function extractPIIValues(entities: DetectedEntity[]): Map<string, EntityType> {
  const piiValues = new Map<string, EntityType>();

  for (const entity of entities) {
    const value = entity.value.trim();
    if (value.length < 2) continue; // Skip very short values

    // Add the full value
    piiValues.set(value, entity.type);

    // For names, also extract individual components and combinations
    if (entity.type === 'name') {
      // Remove parenthetical content for main processing
      const mainName = value.replace(/\s*\([^)]*\)\s*/g, '').trim();

      // Split by spaces
      const parts = mainName.split(/\s+/).filter(p => p.length >= 2);

      // Skip common non-name words
      const skipWords = new Set(['née', 'nee', 'jr', 'sr', 'ii', 'iii', 'iv', 'mr', 'mrs', 'ms', 'dr', 'the', 'and', 'of']);
      const nameParts = parts.filter(p => {
        const lower = p.toLowerCase().replace(/[.,]/g, '');
        return !skipWords.has(lower) && /^[A-Z][a-z]+$/.test(p);
      });

      // Add individual name parts (first names, last names)
      for (const part of nameParts) {
        if (part.length >= 3) {
          piiValues.set(part, 'name');
        }
      }

      // Add first + last name combination if we have 3+ parts (Maria Elena Rodriguez → Maria Rodriguez)
      if (nameParts.length >= 3) {
        const firstLast = `${nameParts[0]} ${nameParts[nameParts.length - 1]}`;
        piiValues.set(firstLast, 'name');
      }

      // Add first two names if we have them (Maria Elena)
      if (nameParts.length >= 2) {
        const firstTwo = `${nameParts[0]} ${nameParts[1]}`;
        piiValues.set(firstTwo, 'name');
      }

      // Handle parenthetical names like "(née Vasquez)"
      const parenthetical = value.match(/\((?:née|nee)?\s*([A-Z][a-z]+)\)/i);
      if (parenthetical && parenthetical[1]) {
        piiValues.set(parenthetical[1], 'name');
      }
    }
  }

  return piiValues;
}

// Final sweep: find all occurrences of known PII values in the text
export function finalSweep(
  text: string,
  piiValues: Map<string, EntityType>,
  existingEntities: DetectedEntity[]
): DetectedEntity[] {
  const newEntities: DetectedEntity[] = [];
  const existingPositions = new Set(existingEntities.map(e => `${e.startIndex}-${e.endIndex}`));

  // Sort by length descending to match longer values first
  const sortedValues = Array.from(piiValues.entries())
    .sort((a, b) => b[0].length - a[0].length);

  for (const [value, type] of sortedValues) {
    if (newEntities.length >= 50) break; // Limit new entities per sweep

    let searchStart = 0;
    while (searchStart < text.length) {
      const index = text.indexOf(value, searchStart);
      if (index === -1) break;

      const endIndex = index + value.length;
      const posKey = `${index}-${endIndex}`;

      // Skip if already detected at this position
      if (!existingPositions.has(posKey)) {
        // Check it's a word boundary (not part of a larger word)
        const charBefore = index > 0 ? text[index - 1] : ' ';
        const charAfter = endIndex < text.length ? text[endIndex] : ' ';
        const isWordBoundary = /[\s,.:;()\[\]"'\-]/.test(charBefore) && /[\s,.:;()\[\]"'\-]/.test(charAfter);

        if (isWordBoundary) {
          existingPositions.add(posKey);
          newEntities.push({
            id: generateId(),
            type,
            value,
            maskedValue: generateMaskedValue(type, value),
            confidence: 0.85,
            method: 'retrospective',
            startIndex: index,
            endIndex,
            context: '',
            shouldRedact: true,
          });
        }
      }

      searchStart = index + 1;
    }
  }

  return newEntities;
}

// ============================================================================
// AGGRESSIVE LABEL FILTERING
// ============================================================================

// Common label patterns that should NEVER be redacted
const LABEL_PATTERNS = [
  /^(spouse|client|patient|employee|employer|mother|father|parent|child|guardian)\s*(name|info|information)?$/i,
  /^(home|work|business|personal|mailing|billing|physical)\s*(address|phone|email|number)$/i,
  /^(first|last|middle|full|maiden|preferred|legal)\s*name$/i,
  /^(date\s*of\s*birth|dob|birth\s*date|ssn|social\s*security)$/i,
  /^(phone|telephone|mobile|cell|fax)\s*(number|no\.?)?$/i,
  /^(email|e-mail)\s*(address)?$/i,
  /^(account|routing|card)\s*(number|no\.?)?$/i,
  /^(net\s*worth|income|salary|expenses?|balance|total|amount)$/i,
  /^(marital\s*status|married|single|divorced|widowed)$/i,
  /^(contact\s*info(rmation)?|personal\s*info(rmation)?)$/i,
];

// Aggressive check if a value is a label (not actual data)
function isDefinitelyLabel(value: string): boolean {
  const normalized = value.trim();

  // Check against label patterns
  for (const pattern of LABEL_PATTERNS) {
    if (pattern.test(normalized)) return true;
  }

  // Check if it ends with a colon (field label)
  if (normalized.endsWith(':')) return true;

  // Check if all words are common label words
  const words = normalized.toLowerCase().split(/\s+/);
  const labelWords = new Set([
    'name', 'names', 'address', 'phone', 'email', 'number', 'date', 'birth', 'dob',
    'ssn', 'social', 'security', 'account', 'spouse', 'client', 'patient', 'home',
    'work', 'personal', 'business', 'first', 'last', 'middle', 'full', 'maiden',
    'contact', 'information', 'info', 'mailing', 'billing', 'status', 'marital',
    'married', 'single', 'employer', 'employee', 'mother', 'father', 'emergency',
  ]);

  if (words.length <= 3 && words.every(w => labelWords.has(w))) {
    return true;
  }

  return false;
}

// Filter out label redactions from entities
export function filterLabelRedactions(entities: DetectedEntity[]): {
  filtered: DetectedEntity[];
  removedCount: number;
} {
  const filtered: DetectedEntity[] = [];
  let removedCount = 0;

  for (const entity of entities) {
    if (isDefinitelyLabel(entity.value)) {
      removedCount++;
    } else {
      filtered.push(entity);
    }
  }

  return { filtered, removedCount };
}
