'use client';

import { useMemo, useRef, useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Eraser } from '@phosphor-icons/react';
import type { DetectedEntity } from '@/types/redaction';

interface DocumentPreviewProps {
  text: string;
  entities: DetectedEntity[];
  showRedacted: boolean;
  selectedEntityId?: string | null;
  onEntityClick?: (entity: DetectedEntity) => void;
  onManualRedact?: (startIndex: number, endIndex: number, selectedText: string) => void;
}

interface TextSegment {
  text: string;
  entity?: DetectedEntity;
  start: number;
  end: number;
}

interface SelectionInfo {
  text: string;
  startIndex: number;
  endIndex: number;
  rect: DOMRect;
}

export function DocumentPreview({
  text,
  entities,
  showRedacted,
  selectedEntityId,
  onEntityClick,
  onManualRedact,
}: DocumentPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const highlightRefs = useRef<Map<string, HTMLSpanElement>>(new Map());
  const [selection, setSelection] = useState<SelectionInfo | null>(null);

  // Generate asterisks for redacted text (one * per character)
  const generateRedactedText = (originalValue: string): string => {
    return '*'.repeat(originalValue.length);
  };

  // Build text segments with entity highlights
  // When showRedacted is true: show asterisks for entities that will be redacted
  // When showRedacted is false: show original text with entity highlighting
  const segments = useMemo(() => {
    if (entities.length === 0) {
      return [{ text, start: 0, end: text.length }] as TextSegment[];
    }

    const result: TextSegment[] = [];
    const sortedEntities = [...entities].sort((a, b) => a.startIndex - b.startIndex);

    let currentPosition = 0;

    for (const entity of sortedEntities) {
      // Add text before this entity
      if (entity.startIndex > currentPosition) {
        result.push({
          text: text.slice(currentPosition, entity.startIndex),
          start: currentPosition,
          end: entity.startIndex,
        });
      }

      // Determine what text to show:
      // - If showing redacted view AND entity should be redacted: show asterisks
      // - Otherwise: show original value (with highlighting if it's an entity)
      const displayText = showRedacted && entity.shouldRedact
        ? generateRedactedText(entity.value)
        : entity.value;

      result.push({
        text: displayText,
        entity,
        start: entity.startIndex,
        end: entity.endIndex,
      });

      currentPosition = entity.endIndex;
    }

    // Add remaining text
    if (currentPosition < text.length) {
      result.push({
        text: text.slice(currentPosition),
        start: currentPosition,
        end: text.length,
      });
    }

    return result;
  }, [text, entities, showRedacted]);

  // Handle text selection
  const handleMouseUp = useCallback(() => {
    const windowSelection = window.getSelection();
    if (!windowSelection || windowSelection.isCollapsed || !contentRef.current) {
      setSelection(null);
      return;
    }

    const selectedText = windowSelection.toString().trim();
    if (!selectedText || selectedText.length === 0) {
      setSelection(null);
      return;
    }

    // Check if selection is within our content
    const range = windowSelection.getRangeAt(0);
    if (!contentRef.current.contains(range.commonAncestorContainer)) {
      setSelection(null);
      return;
    }

    // Find the original document positions by walking through segments
    // We need to map from the visual selection to original document indices
    const startContainer = range.startContainer;
    const endContainer = range.endContainer;

    let startIndex = -1;
    let endIndex = -1;

    // Find which segment contains the start
    const spans = contentRef.current.querySelectorAll('[data-start]');

    for (const span of spans) {
      if (span.contains(startContainer) || span === startContainer.parentElement) {
        const segmentStart = parseInt(span.getAttribute('data-start') || '0', 10);
        const segmentEnd = parseInt(span.getAttribute('data-end') || '0', 10);
        const isRedacted = span.getAttribute('data-redacted') === 'true';

        if (isRedacted) {
          // If selecting within a redacted segment, use the whole segment
          startIndex = segmentStart;
        } else {
          // Calculate offset within the segment
          startIndex = segmentStart + range.startOffset;
        }
      }

      if (span.contains(endContainer) || span === endContainer.parentElement) {
        const segmentStart = parseInt(span.getAttribute('data-start') || '0', 10);
        const segmentEnd = parseInt(span.getAttribute('data-end') || '0', 10);
        const isRedacted = span.getAttribute('data-redacted') === 'true';

        if (isRedacted) {
          // If selecting within a redacted segment, use the whole segment
          endIndex = segmentEnd;
        } else {
          // Calculate offset within the segment
          endIndex = segmentStart + range.endOffset;
        }
      }
    }

    if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
      setSelection(null);
      return;
    }

    // Get the actual text from original document
    const originalText = text.slice(startIndex, endIndex);

    // Get bounding rect for positioning the button
    const rect = range.getBoundingClientRect();

    setSelection({
      text: originalText,
      startIndex,
      endIndex,
      rect,
    });
  }, [text]);

  // Handle redact button click
  const handleRedact = useCallback(() => {
    if (selection && onManualRedact) {
      onManualRedact(selection.startIndex, selection.endIndex, selection.text);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  }, [selection, onManualRedact]);

  // Clear selection when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setSelection(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Scroll to selected entity
  useEffect(() => {
    if (selectedEntityId) {
      const element = highlightRefs.current.get(selectedEntityId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [selectedEntityId]);

  const getEntityHighlightClass = (entity: DetectedEntity, isSelected: boolean): string => {
    const baseClasses = 'cursor-pointer rounded px-0.5 transition-all';

    if (!entity.shouldRedact) {
      return `${baseClasses} bg-muted/50 line-through opacity-60`;
    }

    // Use neutral black/white/grey color scheme for all entity types
    const colorClasses = 'bg-foreground/10 hover:bg-foreground/20 dark:bg-foreground/15 dark:hover:bg-foreground/25';
    const selectedClasses = isSelected ? 'ring-2 ring-foreground ring-offset-1' : '';

    return `${baseClasses} ${colorClasses} ${selectedClasses}`;
  };

  return (
    <div
      ref={containerRef}
      className="relative h-full overflow-auto rounded-lg border border-border bg-white p-6 font-mono text-sm leading-relaxed dark:bg-neutral-900"
    >
      {/* Selection Redact Button */}
      {selection && onManualRedact && (
        <div
          className="fixed z-50 animate-in fade-in zoom-in-95 duration-150"
          style={{
            top: selection.rect.bottom + 8,
            left: selection.rect.left + (selection.rect.width / 2) - 50,
          }}
        >
          <Button
            size="sm"
            onClick={handleRedact}
            className="shadow-lg"
          >
            <Eraser size={16} data-icon="inline-start" />
            Redact
          </Button>
        </div>
      )}

      <div ref={contentRef} className="whitespace-pre-wrap" onMouseUp={handleMouseUp}>
        {segments.map((segment, index) => {
          const isRedacted = segment.entity?.shouldRedact && showRedacted;

          if (segment.entity) {
            const isSelected = selectedEntityId === segment.entity.id;
            return (
              <span
                key={`${segment.entity.id}-${index}`}
                ref={(el) => {
                  if (el) highlightRefs.current.set(segment.entity!.id, el);
                }}
                className={getEntityHighlightClass(segment.entity, isSelected)}
                onClick={() => onEntityClick?.(segment.entity!)}
                title={`${segment.entity.type}: Click to select`}
                data-start={segment.start}
                data-end={segment.end}
                data-redacted={isRedacted ? 'true' : 'false'}
              >
                {segment.text}
              </span>
            );
          }

          return (
            <span
              key={`text-${index}`}
              data-start={segment.start}
              data-end={segment.end}
              data-redacted="false"
            >
              {segment.text}
            </span>
          );
        })}
      </div>
    </div>
  );
}
