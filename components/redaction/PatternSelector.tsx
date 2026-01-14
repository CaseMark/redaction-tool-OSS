'use client';

import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Check, ListChecks, Sliders } from '@phosphor-icons/react';
import type { EntityType } from '@/types/redaction';
import { ENTITY_CONFIG, REDACTION_PRESETS, getEntityTypeLabel } from '@/lib/redaction/patterns';

interface PatternSelectorProps {
  selectedTypes: EntityType[];
  onSelectionChange: (types: EntityType[]) => void;
}

type TabType = 'presets' | 'custom';

export function PatternSelector({ selectedTypes, onSelectionChange }: PatternSelectorProps) {
  const [activeTab, setActiveTab] = useState<TabType>('presets');

  const handlePresetSelect = (presetTypes: EntityType[]) => {
    onSelectionChange(presetTypes);
  };

  const handleTypeToggle = (type: EntityType) => {
    if (selectedTypes.includes(type)) {
      onSelectionChange(selectedTypes.filter(t => t !== type));
    } else {
      onSelectionChange([...selectedTypes, type]);
    }
  };

  const isPresetSelected = (presetTypes: EntityType[]): boolean => {
    if (selectedTypes.length !== presetTypes.length) return false;
    return presetTypes.every(t => selectedTypes.includes(t));
  };

  const entityTypes = Object.keys(ENTITY_CONFIG).filter(t => t !== 'custom') as EntityType[];

  return (
    <div className="space-y-6">
      {/* Tab Switcher */}
      <div className="flex gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'presets' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('presets')}
        >
          <ListChecks size={16} data-icon="inline-start" />
          Presets
        </Button>
        <Button
          variant={activeTab === 'custom' ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('custom')}
        >
          <Sliders size={16} data-icon="inline-start" />
          Custom Selection
        </Button>
      </div>

      {/* Presets Tab */}
      {activeTab === 'presets' && (
        <div className="grid gap-4 sm:grid-cols-2">
          {REDACTION_PRESETS.map((preset) => {
            const isSelected = isPresetSelected(preset.entityTypes);
            return (
              <Card
                key={preset.id}
                size="sm"
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'ring-2 ring-primary'
                    : 'hover:ring-2 hover:ring-primary/50'
                }`}
                onClick={() => handlePresetSelect(preset.entityTypes)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{preset.label}</CardTitle>
                      <CardDescription>{preset.description}</CardDescription>
                    </div>
                    {isSelected && (
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                        <Check size={12} weight="bold" />
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-1.5">
                    {preset.entityTypes.map((type) => (
                      <Badge key={type} variant="outline">
                        {getEntityTypeLabel(type)}
                      </Badge>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Custom Tab */}
      {activeTab === 'custom' && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {entityTypes.map((type) => {
              const config = ENTITY_CONFIG[type];
              const isSelected = selectedTypes.includes(type);
              return (
                <label
                  key={type}
                  className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-all ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => handleTypeToggle(type)}
                    className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <div className="flex-1">
                    <div className="font-medium">{config.label}</div>
                    <div className="text-xs text-muted-foreground">{config.description}</div>
                    {config.examples && config.examples.length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground">
                        Examples: {config.examples.slice(0, 2).join(', ')}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>

          {/* Quick Actions */}
          <div className="flex gap-2 border-t border-border pt-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionChange(entityTypes)}
            >
              Select All
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectionChange([])}
            >
              Clear All
            </Button>
          </div>
        </div>
      )}

      {/* Selection Summary */}
      {selectedTypes.length > 0 && (
        <div className="rounded-lg bg-muted/50 p-4">
          <div className="mb-2 text-sm font-medium">
            {selectedTypes.length} type{selectedTypes.length !== 1 ? 's' : ''} selected
          </div>
          <div className="flex flex-wrap gap-1.5">
            {selectedTypes.map((type) => (
              <Badge key={type} variant="secondary">
                {getEntityTypeLabel(type)}
              </Badge>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
