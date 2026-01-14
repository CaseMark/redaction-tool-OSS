'use client';

import { useState, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  MagnifyingGlass,
  Export,
  CheckCircle,
  SpinnerGap,
  Eye,
  EyeSlash,
  Download,
  FileText,
} from '@phosphor-icons/react';
import { FileUpload, PatternSelector, EntityList, DocumentPreview, ExportModal } from '@/components/redaction';
import type { ProcessedDocument, DetectedEntity, EntityType, WorkflowStep } from '@/types/redaction';
import { createAuditLog } from '@/lib/redaction/detection';

const WORKFLOW_STEPS: { id: WorkflowStep; label: string; description: string }[] = [
  { id: 'upload', label: 'Upload', description: 'Upload your document' },
  { id: 'configure', label: 'Configure', description: 'Select PII types to detect' },
  { id: 'review', label: 'Review', description: 'Review and edit redactions' },
  { id: 'export', label: 'Export', description: 'Download redacted document' },
];

export default function DashboardPage() {
  // Workflow state
  const [currentStep, setCurrentStep] = useState<WorkflowStep>('upload');
  const [isProcessing, setIsProcessing] = useState(false);

  // Document state
  const [document, setDocument] = useState<ProcessedDocument | null>(null);

  // Detection state
  const [selectedEntityTypes, setSelectedEntityTypes] = useState<EntityType[]>(['ssn', 'credit_card', 'account_number']);
  const [detectedEntities, setDetectedEntities] = useState<DetectedEntity[]>([]);
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  // Preview state - default to showing redacted (asterisks) view
  const [showRedactedPreview, setShowRedactedPreview] = useState(true);

  // Export state
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [hasExported, setHasExported] = useState(false);

  const currentStepIndex = WORKFLOW_STEPS.findIndex((s) => s.id === currentStep);

  const handleFileProcessed = useCallback((processedDoc: ProcessedDocument) => {
    setDocument(processedDoc);
    setCurrentStep('configure');
  }, []);

  const handleDetectPII = useCallback(async () => {
    if (!document) return;

    setIsProcessing(true);

    try {
      const response = await fetch('/api/detect-pii', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: document.text,
          entityTypes: selectedEntityTypes,
          enableLLM: true,
          enableRetrospective: true,
        }),
      });

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const result = await response.json();
      setDetectedEntities(result.entities);
      setCurrentStep('review');
    } catch (error) {
      console.error('Detection error:', error);
    } finally {
      setIsProcessing(false);
    }
  }, [document, selectedEntityTypes]);

  const handleEntityUpdate = useCallback((id: string, updates: Partial<DetectedEntity>) => {
    setDetectedEntities((prev) =>
      prev.map((entity) =>
        entity.id === id ? { ...entity, ...updates } : entity
      )
    );
  }, []);

  const handleEntityDelete = useCallback((id: string) => {
    setDetectedEntities((prev) => prev.filter((entity) => entity.id !== id));
    // Clear selection if deleted entity was selected
    if (selectedEntityId === id) {
      setSelectedEntityId(null);
    }
  }, [selectedEntityId]);

  const handleManualRedact = useCallback((startIndex: number, endIndex: number, selectedText: string) => {
    // Check if this overlaps with an existing entity
    const overlapping = detectedEntities.find(
      (e) => (startIndex >= e.startIndex && startIndex < e.endIndex) ||
             (endIndex > e.startIndex && endIndex <= e.endIndex) ||
             (startIndex <= e.startIndex && endIndex >= e.endIndex)
    );

    if (overlapping) {
      // If overlapping with existing entity, just ensure it's marked for redaction
      handleEntityUpdate(overlapping.id, { shouldRedact: true });
      return;
    }

    // Create a new manual redaction entity
    const newEntity: DetectedEntity = {
      id: crypto.randomUUID(),
      type: 'custom',
      value: selectedText,
      maskedValue: '*'.repeat(selectedText.length),
      confidence: 1.0,
      method: 'manual',
      startIndex,
      endIndex,
      context: document?.text.slice(
        Math.max(0, startIndex - 30),
        Math.min(document.text.length, endIndex + 30)
      ) || selectedText,
      shouldRedact: true,
    };

    // Add to entities and sort by position
    setDetectedEntities((prev) => {
      const updated = [...prev, newEntity];
      return updated.sort((a, b) => a.startIndex - b.startIndex);
    });

    // Select the new entity
    setSelectedEntityId(newEntity.id);
  }, [detectedEntities, document, handleEntityUpdate]);

  const handleOpenExportModal = useCallback(() => {
    setExportModalOpen(true);
  }, []);

  const handleExportModalClose = useCallback((open: boolean) => {
    setExportModalOpen(open);
  }, []);

  const handleExportDownload = useCallback(() => {
    setHasExported(true);
    setCurrentStep('export');
  }, []);

  const handleDownloadAuditLog = useCallback(() => {
    if (!document) return;

    const auditLog = createAuditLog(document.fileName, detectedEntities);
    const blob = new Blob([JSON.stringify(auditLog, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `audit-log-${document.fileName.replace(/\.[^.]+$/, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [document, detectedEntities]);

  const handleStartOver = useCallback(() => {
    setCurrentStep('upload');
    setDocument(null);
    setSelectedEntityTypes(['ssn', 'credit_card', 'account_number']);
    setDetectedEntities([]);
    setSelectedEntityId(null);
    setShowRedactedPreview(true);
    setExportModalOpen(false);
    setHasExported(false);
  }, []);

  const canProceed = () => {
    switch (currentStep) {
      case 'upload':
        return !!document;
      case 'configure':
        return selectedEntityTypes.length > 0;
      case 'review':
        // Allow export even with no entities (user may have added manual redactions or want no redactions)
        return true;
      default:
        return false;
    }
  };

  const handleNext = () => {
    switch (currentStep) {
      case 'configure':
        handleDetectPII();
        break;
      case 'review':
        handleOpenExportModal();
        break;
    }
  };

  const handleBack = () => {
    const prevIndex = currentStepIndex - 1;
    if (prevIndex >= 0) {
      setCurrentStep(WORKFLOW_STEPS[prevIndex].id);
    }
  };

  return (
    <div className="min-h-screen">
      {/* Progress Steps */}
      <div className="border-b border-border bg-card">
        <div className="px-4 md:px-8 lg:px-12 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              {WORKFLOW_STEPS.map((step, index) => {
                const isActive = step.id === currentStep;
                const isCompleted = index < currentStepIndex;

                return (
                  <div key={step.id} className="flex items-center">
                    <div
                      className={`flex items-center gap-2 rounded-full px-3 sm:px-4 py-2 transition-all duration-200 ${
                        isActive
                          ? 'bg-primary text-primary-foreground'
                          : isCompleted
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground'
                      }`}
                    >
                      {isCompleted ? (
                        <CheckCircle size={18} weight="fill" />
                      ) : (
                        <span className={`flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                          isActive ? 'bg-primary-foreground/20' : 'border border-current'
                        }`}>
                          {index + 1}
                        </span>
                      )}
                      <span className="text-sm font-medium hidden sm:inline">{step.label}</span>
                    </div>
                    {index < WORKFLOW_STEPS.length - 1 && (
                      <div
                        className={`mx-1 sm:mx-2 h-0.5 w-4 sm:w-8 hidden sm:block transition-colors ${
                          isCompleted ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            {document && (
              <Button variant="ghost" size="sm" onClick={handleStartOver}>
                Start Over
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 md:px-8 lg:px-12 py-8 md:py-12 max-w-7xl mx-auto">
        {/* Step 1: Upload */}
        {currentStep === 'upload' && (
          <div className="mx-auto max-w-2xl">
            <div className="text-center mb-8">
              <h1 className="text-2xl md:text-3xl font-normal mb-3">Upload a Document</h1>
              <p className="text-muted-foreground">
                Upload a document to scan for personally identifiable information
              </p>
            </div>
            <FileUpload onFileProcessed={handleFileProcessed} isProcessing={isProcessing} />
          </div>
        )}

        {/* Step 2: Configure */}
        {currentStep === 'configure' && document && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Select PII Types to Detect</CardTitle>
                <CardDescription>
                  Choose which types of personally identifiable information to scan for in your
                  document.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <PatternSelector
                  selectedTypes={selectedEntityTypes}
                  onSelectionChange={setSelectedEntityTypes}
                />
              </CardContent>
            </Card>

            {/* Document Info */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Document Info</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">File:</span>{' '}
                    <span className="font-medium">{document.fileName}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Size:</span>{' '}
                    <span className="font-medium">
                      {(document.fileSize / 1024).toFixed(1)} KB
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Characters:</span>{' '}
                    <span className="font-medium">{document.text.length.toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft size={16} data-icon="inline-start" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!canProceed() || isProcessing}>
                {isProcessing ? (
                  <>
                    <SpinnerGap size={16} className="animate-spin" data-icon="inline-start" />
                    Detecting PII...
                  </>
                ) : (
                  <>
                    <MagnifyingGlass size={16} data-icon="inline-start" />
                    Detect PII
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Review */}
        {currentStep === 'review' && document && (
          <div className="space-y-6">
            {/* Stats Bar */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 rounded-lg border border-border bg-card p-4">
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant="secondary">
                  {detectedEntities.length} entities found
                </Badge>
                <Badge>
                  {detectedEntities.filter((e) => e.shouldRedact).length} will be redacted
                </Badge>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowRedactedPreview(!showRedactedPreview)}
              >
                {showRedactedPreview ? (
                  <>
                    <EyeSlash size={16} data-icon="inline-start" />
                    Show Original
                  </>
                ) : (
                  <>
                    <Eye size={16} data-icon="inline-start" />
                    Preview Redacted
                  </>
                )}
              </Button>
            </div>

            {/* Split View */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Entity List */}
              <div className="flex flex-col">
                <h3 className="mb-3 font-medium">Detected Entities</h3>
                <div className="h-[500px]">
                  <EntityList
                    entities={detectedEntities}
                    onEntityUpdate={handleEntityUpdate}
                    onEntityDelete={handleEntityDelete}
                    onSelectEntity={(entity) => setSelectedEntityId(entity?.id || null)}
                    selectedEntityId={selectedEntityId}
                  />
                </div>
              </div>

              {/* Document Preview */}
              <div className="flex flex-col">
                <h3 className="mb-3 font-medium">Document Preview</h3>
                <p className="mb-2 text-xs text-muted-foreground">
                  Select text and click &quot;Redact&quot; to add manual redactions
                </p>
                <div className="h-[500px]">
                  <DocumentPreview
                    text={document.text}
                    entities={detectedEntities}
                    showRedacted={showRedactedPreview}
                    selectedEntityId={selectedEntityId}
                    onEntityClick={(entity) => setSelectedEntityId(entity.id)}
                    onManualRedact={handleManualRedact}
                  />
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="flex justify-between">
              <Button variant="outline" onClick={handleBack}>
                <ArrowLeft size={16} data-icon="inline-start" />
                Back
              </Button>
              <Button onClick={handleNext} disabled={!canProceed()}>
                <Export size={16} data-icon="inline-start" />
                Export Document
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Export */}
        {currentStep === 'export' && document && hasExported && (
          <div className="mx-auto max-w-2xl space-y-6">
            <Card>
              <CardContent className="flex flex-col items-center py-12 text-center">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <CheckCircle size={40} weight="fill" className="text-primary" />
                </div>
                <h2 className="mb-2 text-2xl font-normal">Redaction Complete!</h2>
                <p className="mb-6 text-muted-foreground">
                  Your document has been successfully processed with{' '}
                  {detectedEntities.filter((e) => e.shouldRedact).length} redactions applied.
                </p>

                <div className="flex flex-col gap-3 sm:flex-row">
                  <Button onClick={handleOpenExportModal}>
                    <Download size={16} data-icon="inline-start" />
                    Export Again
                  </Button>
                  <Button variant="outline" onClick={handleDownloadAuditLog}>
                    <FileText size={16} data-icon="inline-start" />
                    Download Audit Log
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Summary */}
            <Card size="sm">
              <CardHeader>
                <CardTitle className="text-sm">Redaction Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Original File:</span>
                    <span>{document.fileName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Entities Found:</span>
                    <span>{detectedEntities.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Entities Redacted:</span>
                    <span>{detectedEntities.filter((e) => e.shouldRedact).length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Processed At:</span>
                    <span>{new Date().toLocaleString()}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex justify-center">
              <Button variant="outline" onClick={handleStartOver}>
                Process Another Document
              </Button>
            </div>
          </div>
        )}

        {/* Export Modal */}
        {document && (
          <ExportModal
            open={exportModalOpen}
            onOpenChange={handleExportModalClose}
            onDownload={handleExportDownload}
            text={document.text}
            entities={detectedEntities}
            fileName={document.fileName}
          />
        )}
      </div>
    </div>
  );
}
