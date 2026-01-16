import { NextRequest, NextResponse } from 'next/server';
import type { EntityType, DetectedEntity } from '@/types/redaction';
import { detectWithRegex, mergeDetectionResults } from '@/lib/redaction/detection';
import { detectWithLLM, detectRetrospective, verifyPatternMatches, computeEntityContext, extractPIIValues, finalSweep, filterLabelRedactions, type TokenUsage } from '@/lib/redaction/llm-detection';
import { isValidEntityType } from '@/lib/redaction/patterns';

export const maxDuration = 60; // Allow up to 60 seconds for LLM detection

// Memory limits - increased with 16GB heap
const MAX_ENTITIES = 300;
const MAX_TEXT_FOR_FULL_PROCESSING = 40000; // 40KB - above this, skip retrospective
const MAX_TEXT_FOR_ANY_LLM = 80000; // 80KB - above this, regex only

interface DetectPIIRequestBody {
  text: string;
  entityTypes: string[];
  enableLLM?: boolean;
  enableRetrospective?: boolean;
  enableVerification?: boolean;
}

interface UsageMetadata {
  llmInputTokens: number;
  llmOutputTokens: number;
}

export async function POST(request: NextRequest) {
  try {
    const body: DetectPIIRequestBody = await request.json();

    // Validate request
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required and must be a string' },
        { status: 400 }
      );
    }

    if (!body.entityTypes || !Array.isArray(body.entityTypes) || body.entityTypes.length === 0) {
      return NextResponse.json(
        { error: 'At least one entity type is required' },
        { status: 400 }
      );
    }

    // Validate entity types
    const validEntityTypes: EntityType[] = body.entityTypes.filter(
      (type): type is EntityType => isValidEntityType(type)
    );

    if (validEntityTypes.length === 0) {
      return NextResponse.json(
        { error: 'No valid entity types provided' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const methods: string[] = ['regex'];
    let allEntities: DetectedEntity[] = [];
    let labelsFiltered = 0;
    const textLength = body.text.length;
    const isLargeText = textLength > MAX_TEXT_FOR_FULL_PROCESSING;
    const isVeryLargeText = textLength > MAX_TEXT_FOR_ANY_LLM;

    // Track token usage
    const usage: UsageMetadata = {
      llmInputTokens: 0,
      llmOutputTokens: 0,
    };

    // Pass 1: Regex detection (fast, high precision)
    const regexEntities = detectWithRegex(body.text, validEntityTypes);
    // Limit regex entities to prevent memory issues
    allEntities = regexEntities.slice(0, MAX_ENTITIES);

    // Pass 2: LLM detection (if enabled, skip for very large texts)
    if (!isVeryLargeText && body.enableLLM !== false && process.env.CASEDEV_API_KEY && allEntities.length < MAX_ENTITIES) {
      try {
        const llmResult = await detectWithLLM(body.text, validEntityTypes);
        usage.llmInputTokens += llmResult.usage.inputTokens;
        usage.llmOutputTokens += llmResult.usage.outputTokens;
        if (llmResult.entities.length > 0) {
          methods.push('llm');
          allEntities = mergeDetectionResults(allEntities, llmResult.entities).slice(0, MAX_ENTITIES);
        }
        // Help GC
        llmResult.entities.length = 0;
      } catch (error) {
        console.error('LLM detection failed:', error);
      }
    }

    // Pass 3: AI Verification - filter out labels (skip for very large texts)
    if (!isVeryLargeText && body.enableVerification !== false && allEntities.length > 0 && process.env.CASEDEV_API_KEY) {
      try {
        const verificationResult = await verifyPatternMatches(allEntities, body.text);
        usage.llmInputTokens += verificationResult.usage.inputTokens;
        usage.llmOutputTokens += verificationResult.usage.outputTokens;
        if (verificationResult.filteredCount > 0) {
          methods.push('verification');
          allEntities = verificationResult.entities;
          labelsFiltered = verificationResult.filteredCount;
        }
      } catch (error) {
        console.error('Verification failed:', error);
      }
    }

    // Pass 4: Retrospective detection (only for smaller texts)
    if (!isLargeText && body.enableRetrospective !== false && allEntities.length > 0 && allEntities.length < MAX_ENTITIES && process.env.CASEDEV_API_KEY) {
      try {
        const retrospectiveResult = await detectRetrospective(
          body.text,
          allEntities,
          validEntityTypes
        );
        usage.llmInputTokens += retrospectiveResult.usage.inputTokens;
        usage.llmOutputTokens += retrospectiveResult.usage.outputTokens;
        if (retrospectiveResult.entities.length > 0) {
          methods.push('retrospective');
          allEntities = mergeDetectionResults(allEntities, retrospectiveResult.entities).slice(0, MAX_ENTITIES);
        }
        // Help GC
        retrospectiveResult.entities.length = 0;
      } catch (error) {
        console.error('Retrospective detection failed:', error);
      }
    }

    // Pass 5: Final sweep - find all occurrences of detected PII values
    // This catches names like "Maria Rodriguez" that appear multiple times
    if (allEntities.length > 0) {
      try {
        const piiValues = extractPIIValues(allEntities);
        const sweepEntities = finalSweep(body.text, piiValues, allEntities);
        if (sweepEntities.length > 0) {
          methods.push('sweep');
          allEntities = mergeDetectionResults(allEntities, sweepEntities).slice(0, MAX_ENTITIES);
        }
      } catch (error) {
        console.error('Final sweep failed:', error);
      }
    }

    // Pass 6: Aggressive label filtering - remove any remaining labels
    const labelFilterResult = filterLabelRedactions(allEntities);
    allEntities = labelFilterResult.filtered;
    labelsFiltered += labelFilterResult.removedCount;

    // Compute contexts lazily only for final entities (memory efficient)
    // Only compute for first 100 entities to save memory
    const entitiesWithContext = allEntities.slice(0, 100).map(entity => ({
      ...entity,
      context: entity.context || computeEntityContext(entity, body.text),
    }));
    // Add remaining entities without context
    if (allEntities.length > 100) {
      entitiesWithContext.push(...allEntities.slice(100));
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      entities: entitiesWithContext,
      totalMatches: entitiesWithContext.length,
      labelsFiltered,
      processingTime,
      methods,
      usage,
      textLength,
      limitedProcessing: isLargeText || isVeryLargeText,
    });
  } catch (error) {
    console.error('PII detection error:', error);
    const message = error instanceof Error ? error.message : 'Detection failed';
    return NextResponse.json(
      { error: 'PII detection failed', details: message },
      { status: 500 }
    );
  }
}
