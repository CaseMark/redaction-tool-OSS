import type { EntityType, DetectedEntity } from '@/types/redaction';
import { generateMaskedValue, ENTITY_CONFIG } from './patterns';

const CASEDEV_API_URL = process.env.CASEDEV_API_URL || 'https://api.case.dev';
const CASEDEV_API_KEY = process.env.CASEDEV_API_KEY;

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

// Build prompt for PII detection
function buildDetectionPrompt(text: string, entityTypes: EntityType[]): string {
  const typeDescriptions = entityTypes
    .map(type => {
      const config = ENTITY_CONFIG[type];
      return `- ${config.label}: ${config.description}`;
    })
    .join('\n');

  return `You are a PII detection expert. Analyze the following text and identify ALL instances of personally identifiable information (PII).

Look for these specific types of PII:
${typeDescriptions}

For each PII instance found, provide:
1. The exact text value as it appears
2. The type of PII
3. The character position (approximate start index)
4. A confidence score (0.0 to 1.0)

Be thorough and moderately aggressive - it's better to flag something uncertain than miss actual PII.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "entities": [
    {
      "value": "exact text found",
      "type": "ssn|account_number|credit_card|name|address|phone|email|date_of_birth",
      "position": 123,
      "confidence": 0.95
    }
  ]
}

If no PII is found, respond with: {"entities": []}

TEXT TO ANALYZE:
---
${text}
---`;
}

// Detect PII using LLM
export async function detectWithLLM(
  text: string,
  entityTypes: EntityType[]
): Promise<LLMDetectionResult> {
  const emptyResult: LLMDetectionResult = { entities: [], usage: { inputTokens: 0, outputTokens: 0 } };

  if (!CASEDEV_API_KEY) {
    console.warn('CASEDEV_API_KEY not configured - skipping LLM detection');
    return emptyResult;
  }

  try {
    const prompt = buildDetectionPrompt(text, entityTypes);

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
            content: 'You are a PII detection expert. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.1,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      console.error('LLM detection failed:', await response.text());
      return emptyResult;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    // Extract token usage from response
    const usage: TokenUsage = {
      inputTokens: result.usage?.prompt_tokens || 0,
      outputTokens: result.usage?.completion_tokens || 0,
    };

    if (!content) {
      return { entities: [], usage };
    }

    // Parse JSON response
    let parsed;
    try {
      // Handle potential markdown code blocks
      const jsonContent = content.replace(/```json\n?|\n?```/g, '').trim();
      parsed = JSON.parse(jsonContent);
    } catch {
      console.error('Failed to parse LLM response:', content);
      return { entities: [], usage };
    }

    if (!parsed.entities || !Array.isArray(parsed.entities)) {
      return { entities: [], usage };
    }

    // Convert to DetectedEntity format
    const entities: DetectedEntity[] = [];

    for (const item of parsed.entities) {
      if (!item.value || !item.type) continue;

      // Validate entity type
      if (!entityTypes.includes(item.type as EntityType)) continue;

      // Find actual position in text
      const startIndex = text.indexOf(item.value);
      if (startIndex === -1) continue;

      const endIndex = startIndex + item.value.length;

      entities.push({
        id: generateId(),
        type: item.type as EntityType,
        value: item.value,
        maskedValue: generateMaskedValue(item.type as EntityType, item.value),
        confidence: Math.min(1, Math.max(0, item.confidence || 0.8)),
        method: 'llm',
        startIndex,
        endIndex,
        context: extractContext(text, startIndex, endIndex),
        shouldRedact: true,
      });
    }

    return { entities, usage };
  } catch (error) {
    console.error('LLM detection error:', error);
    return emptyResult;
  }
}

// Extract context around a match
function extractContext(text: string, startIndex: number, endIndex: number, contextLength: number = 50): string {
  const contextStart = Math.max(0, startIndex - contextLength);
  const contextEnd = Math.min(text.length, endIndex + contextLength);
  let context = text.slice(contextStart, contextEnd);

  if (contextStart > 0) context = '...' + context;
  if (contextEnd < text.length) context = context + '...';

  return context;
}

// Retrospective detection - second pass to catch missed items
export async function detectRetrospective(
  text: string,
  existingEntities: DetectedEntity[],
  entityTypes: EntityType[]
): Promise<LLMDetectionResult> {
  const emptyResult: LLMDetectionResult = { entities: [], usage: { inputTokens: 0, outputTokens: 0 } };

  if (!CASEDEV_API_KEY) {
    return emptyResult;
  }

  // Build list of already detected values
  const detectedValues = existingEntities.map(e => e.value);

  const prompt = `You previously detected these PII items in a document:
${detectedValues.map(v => `- "${v}"`).join('\n')}

Now do a SECOND PASS through the same text. Look for any PII that might have been missed, especially:
- Similar patterns to what was already found (e.g., if you found one SSN, look for others)
- PII in different formats than the ones already detected
- Names, addresses, or other entities that might be contextually related

Be moderately aggressive - flag uncertain items.

IMPORTANT: Respond ONLY with valid JSON in this exact format:
{
  "entities": [
    {
      "value": "exact text found",
      "type": "ssn|account_number|credit_card|name|address|phone|email|date_of_birth",
      "position": 123,
      "confidence": 0.85
    }
  ]
}

If no additional PII is found, respond with: {"entities": []}

TEXT TO ANALYZE:
---
${text}
---`;

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
            content: 'You are a PII detection expert doing a second-pass review. Always respond with valid JSON only.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.2,
        max_tokens: 4000,
      }),
    });

    if (!response.ok) {
      return emptyResult;
    }

    const result = await response.json();
    const content = result.choices?.[0]?.message?.content;

    // Extract token usage from response
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

      // Skip if already detected
      if (detectedValues.includes(item.value)) continue;

      // Validate entity type
      if (!entityTypes.includes(item.type as EntityType)) continue;

      const startIndex = text.indexOf(item.value);
      if (startIndex === -1) continue;

      const endIndex = startIndex + item.value.length;

      entities.push({
        id: crypto.randomUUID(),
        type: item.type as EntityType,
        value: item.value,
        maskedValue: generateMaskedValue(item.type as EntityType, item.value),
        confidence: Math.min(1, Math.max(0, (item.confidence || 0.75) * 0.9)), // Slightly lower confidence for retrospective
        method: 'retrospective',
        startIndex,
        endIndex,
        context: extractContext(text, startIndex, endIndex),
        shouldRedact: true,
      });
    }

    return { entities, usage };
  } catch (error) {
    console.error('Retrospective detection error:', error);
    return emptyResult;
  }
}
