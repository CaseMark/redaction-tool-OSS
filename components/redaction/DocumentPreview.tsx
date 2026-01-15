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

  // Helper to find the parent span with data-start attribute
  const findParentSpan = useCallback((node: Node): Element | null => {
    let current: Node | null = node;
    while (current && current !== contentRef.current) {
      if (current.nodeType === Node.ELEMENT_NODE) {
        const element = current as Element;
        if (element.hasAttribute('data-start')) {
          return element;
        }
      }
      current = current.parentNode;
    }
    return null;
  }, []);

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

    // Find the parent spans for start and end containers
    const startSpan = findParentSpan(range.startContainer);
    const endSpan = findParentSpan(range.endContainer);

    if (!startSpan || !endSpan) {
      setSelection(null);
      return;
    }

    // Calculate start index
    const startSegmentStart = parseInt(startSpan.getAttribute('data-start') || '0', 10);
    const startIsRedacted = startSpan.getAttribute('data-redacted') === 'true';
    const startSegmentEnd = parseInt(startSpan.getAttribute('data-end') || '0', 10);

    let startIndex: number;
    if (startIsRedacted) {
      // If selecting within a redacted segment, use the segment start
      startIndex = startSegmentStart;
    } else {
      // Calculate offset within the segment
      startIndex = startSegmentStart + range.startOffset;
    }

    // Calculate end index
    const endSegmentStart = parseInt(endSpan.getAttribute('data-start') || '0', 10);
    const endIsRedacted = endSpan.getAttribute('data-redacted') === 'true';
    const endSegmentEnd = parseInt(endSpan.getAttribute('data-end') || '0', 10);

    let endIndex: number;
    if (endIsRedacted) {
      // If selecting within a redacted segment, use the segment end
      endIndex = endSegmentEnd;
    } else {
      // Calculate offset within the segment
      endIndex = endSegmentStart + range.endOffset;
    }

    // Validate indices
    if (startIndex < 0 || endIndex < 0 || startIndex >= endIndex || endIndex > text.length) {
      setSelection(null);
      return;
    }

    // Get the actual text from original document
    const originalText = text.slice(startIndex, endIndex);

    // Validate that we got actual text
    if (!originalText || originalText.length === 0) {
      setSelection(null);
      return;
    }

    // Get bounding rect for positioning the button
    const rect = range.getBoundingClientRect();

    setSelection({
      text: originalText,
      startIndex,
      endIndex,
      rect,
    });
  }, [text, findParentSpan]);

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
