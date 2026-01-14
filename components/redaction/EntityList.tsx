'use client';

import { useState, useMemo, useRef, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  MagnifyingGlass,
  Eye,
  EyeSlash,
  PencilSimple,
  Check,
  X,
  CheckSquare,
  Square,
  Trash,
} from '@phosphor-icons/react';
import type { DetectedEntity, EntityType } from '@/types/redaction';
import { getEntityTypeLabel } from '@/lib/redaction/patterns';

interface EntityListProps {
  entities: DetectedEntity[];
  onEntityUpdate: (id: string, updates: Partial<DetectedEntity>) => void;
  onEntityDelete?: (id: string) => void;
  onSelectEntity?: (entity: DetectedEntity | null) => void;
  selectedEntityId?: string | null;
}

export function EntityList({
  entities,
  onEntityUpdate,
  onEntityDelete,
  onSelectEntity,
  selectedEntityId,
}: EntityListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showMasked, setShowMasked] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const entityRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter entities based on search
  const filteredEntities = useMemo(() => {
    if (!searchQuery.trim()) return entities;

    const query = searchQuery.toLowerCase();
    return entities.filter(
      (entity) =>
        entity.value.toLowerCase().includes(query) ||
        entity.type.toLowerCase().includes(query) ||
        entity.maskedValue.toLowerCase().includes(query)
    );
  }, [entities, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = entities.length;
    const toRedact = entities.filter((e) => e.shouldRedact).length;
    const byType: Record<string, number> = {};
    entities.forEach((e) => {
      byType[e.type] = (byType[e.type] || 0) + 1;
    });
    return { total, toRedact, byType };
  }, [entities]);

  // Scroll to selected entity
  useEffect(() => {
    if (selectedEntityId) {
      const element = entityRefs.current.get(selectedEntityId);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [selectedEntityId]);

  const handleToggleAll = (shouldRedact: boolean) => {
    filteredEntities.forEach((entity) => {
      onEntityUpdate(entity.id, { shouldRedact });
    });
  };

  const handleStartEdit = (entity: DetectedEntity) => {
    setEditingId(entity.id);
    setEditValue(entity.maskedValue);
  };

  const handleSaveEdit = (id: string) => {
    onEntityUpdate(id, { maskedValue: editValue });
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditValue('');
  };

  const getConfidenceColor = (confidence: number): string => {
    // Use neutral grey color scheme - higher confidence = darker text
    if (confidence >= 0.9) return 'text-foreground';
    if (confidence >= 0.7) return 'text-muted-foreground';
    return 'text-muted-foreground/70';
  };

  const getMethodLabel = (method: string): string => {
    switch (method) {
      case 'regex':
        return 'Pattern Match';
      case 'llm':
        return 'AI Detection';
      case 'retrospective':
        return 'Second Pass';
      case 'vault_semantic':
        return 'Semantic Search';
      case 'manual':
        return 'Manual';
      default:
        return method;
    }
  };

  return (
    <div className="flex h-full flex-col gap-4">
      {/* Stats Bar */}
      <div className="flex flex-wrap items-center gap-4 rounded-lg bg-muted/50 p-3">
        <div className="text-sm">
          <span className="font-medium">{stats.total}</span> entities found
        </div>
        <div className="text-sm">
          <span className="font-medium">{stats.toRedact}</span> to be redacted
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowMasked(!showMasked)}
        >
          {showMasked ? <EyeSlash size={16} /> : <Eye size={16} />}
          {showMasked ? 'Show Original' : 'Show Redacted'}
        </Button>
      </div>

      {/* Search and Actions */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Button variant="outline" size="sm" onClick={() => handleToggleAll(true)}>
          <CheckSquare size={16} data-icon="inline-start" />
          Select All
        </Button>
        <Button variant="outline" size="sm" onClick={() => handleToggleAll(false)}>
          <Square size={16} data-icon="inline-start" />
          Deselect All
        </Button>
      </div>

      {/* Entity List */}
      <div className="flex-1 overflow-auto rounded-lg border border-border">
        {filteredEntities.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-muted-foreground">
            {searchQuery ? 'No entities match your search' : 'No entities detected'}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredEntities.map((entity) => {
              const isSelected = selectedEntityId === entity.id;
              const isEditing = editingId === entity.id;

              return (
                <div
                  key={entity.id}
                  ref={(el) => {
                    if (el) entityRefs.current.set(entity.id, el);
                  }}
                  className={`p-3 transition-colors ${
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50'
                  } ${!entity.shouldRedact ? 'opacity-60' : ''}`}
                  onClick={() => onSelectEntity?.(entity)}
                >
                  <div className="flex items-start gap-3">
                    {/* Checkbox */}
                    <input
                      type="checkbox"
                      checked={entity.shouldRedact}
                      onChange={(e) => {
                        e.stopPropagation();
                        onEntityUpdate(entity.id, { shouldRedact: !entity.shouldRedact });
                      }}
                      className="mt-1 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                    />

                    {/* Entity Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{getEntityTypeLabel(entity.type)}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {getMethodLabel(entity.method)}
                        </Badge>
                        <span className={`text-xs ${getConfidenceColor(entity.confidence)}`}>
                          {Math.round(entity.confidence * 100)}% confidence
                        </span>
                      </div>

                      <div className="mt-2">
                        {isEditing ? (
                          <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                            <Input
                              value={editValue}
                              onChange={(e) => setEditValue(e.target.value)}
                              className="h-8 text-sm"
                              autoFocus
                            />
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => handleSaveEdit(entity.id)}
                            >
                              <Check size={14} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              onClick={handleCancelEdit}
                            >
                              <X size={14} />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            <code className="rounded bg-muted px-2 py-1 text-sm font-mono">
                              {showMasked ? entity.maskedValue : entity.value}
                            </code>
                            {entity.shouldRedact && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleStartEdit(entity);
                                }}
                                title="Edit redaction text"
                              >
                                <PencilSimple size={14} />
                              </Button>
                            )}
                            {onEntityDelete && (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEntityDelete(entity.id);
                                }}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="Delete redaction"
                              >
                                <Trash size={14} />
                              </Button>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Context preview */}
                      {entity.context && (
                        <div className="mt-2 text-xs text-muted-foreground line-clamp-2">
                          {entity.context}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
