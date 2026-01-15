import { NextRequest, NextResponse } from 'next/server';
import type { EntityType, DetectedEntity } from '@/types/redaction';
import { detectWithRegex, mergeDetectionResults } from '@/lib/redaction/detection';
import { detectWithLLM, detectRetrospective, type TokenUsage } from '@/lib/redaction/llm-detection';
import { isValidEntityType } from '@/lib/redaction/patterns';

export const maxDuration = 60; // Allow up to 60 seconds for LLM detection

interface DetectPIIRequestBody {
  text: string;
  entityTypes: string[];
  enableLLM?: boolean;
  enableRetrospective?: boolean;
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

    // Track token usage
    const usage: UsageMetadata = {
      llmInputTokens: 0,
      llmOutputTokens: 0,
    };

    // Pass 1: Regex detection (fast, high precision)
    const regexEntities = detectWithRegex(body.text, validEntityTypes);
    allEntities = [...regexEntities];

    // Pass 2: LLM detection (if enabled and API key is available)
    if (body.enableLLM !== false && process.env.CASEDEV_API_KEY) {
      try {
        const llmResult = await detectWithLLM(body.text, validEntityTypes);
        usage.llmInputTokens += llmResult.usage.inputTokens;
        usage.llmOutputTokens += llmResult.usage.outputTokens;
        if (llmResult.entities.length > 0) {
          methods.push('llm');
          allEntities = mergeDetectionResults(allEntities, llmResult.entities);
        }
      } catch (error) {
        console.error('LLM detection failed:', error);
        // Continue without LLM results
      }
    }

    // Pass 3: Retrospective detection (if enabled and we have initial results)
    if (body.enableRetrospective !== false && allEntities.length > 0 && process.env.CASEDEV_API_KEY) {
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
          allEntities = mergeDetectionResults(allEntities, retrospectiveResult.entities);
        }
      } catch (error) {
        console.error('Retrospective detection failed:', error);
        // Continue without retrospective results
      }
    }

    const processingTime = Date.now() - startTime;

    return NextResponse.json({
      entities: allEntities,
      totalMatches: allEntities.length,
      processingTime,
      methods,
      usage,
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
