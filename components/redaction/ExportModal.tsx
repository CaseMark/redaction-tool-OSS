'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';
import {
  FilePdf,
  FileDoc,
  FileText,
  Download,
  SpinnerGap,
  X,
} from '@phosphor-icons/react';
import type { DetectedEntity, ExportFormat, ExportPreviewData } from '@/types/redaction';
import {
  generateExportPreview,
  downloadFromPreview,
  cleanupPreview,
  type ExportMetadata,
} from '@/lib/export';

interface ExportModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDownload?: () => void;
  text: string;
  entities: DetectedEntity[];
  fileName: string;
}

const FORMAT_OPTIONS: { format: ExportFormat; label: string; icon: typeof FilePdf }[] = [
  { format: 'pdf', label: 'PDF', icon: FilePdf },
  { format: 'docx', label: 'Word (DOCX)', icon: FileDoc },
  { format: 'txt', label: 'Plain Text', icon: FileText },
];

export function ExportModal({
  open,
  onOpenChange,
  onDownload,
  text,
  entities,
  fileName,
}: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('pdf');
  const [isGenerating, setIsGenerating] = useState(false);
  const [preview, setPreview] = useState<ExportPreviewData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const previewRef = useRef<ExportPreviewData | null>(null);

  // Generate preview when format changes or modal opens
  const generatePreview = useCallback(async () => {
    if (!open || !text) return;

    setIsGenerating(true);
    setError(null);

    // Clean up previous preview
    if (previewRef.current) {
      cleanupPreview(previewRef.current);
      previewRef.current = null;
    }

    try {
      const metadata: ExportMetadata = {
        fileName,
        processedAt: new Date(),
        totalEntities: entities.length,
        redactedEntities: entities.filter(e => e.shouldRedact).length,
      };

      const newPreview = await generateExportPreview(text, entities, metadata, {
        format: selectedFormat,
      });

      previewRef.current = newPreview;
      setPreview(newPreview);
    } catch (err) {
      console.error('Export preview error:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate preview');
      setPreview(null);
    } finally {
      setIsGenerating(false);
    }
  }, [open, text, entities, fileName, selectedFormat]);

  // Generate preview on mount or format change
  useEffect(() => {
    if (open) {
      generatePreview();
    }
  }, [open, selectedFormat, generatePreview]);

  // Cleanup on close
  useEffect(() => {
    if (!open && previewRef.current) {
      cleanupPreview(previewRef.current);
      previewRef.current = null;
      setPreview(null);
    }
  }, [open]);

  // Handle download
  const handleDownload = useCallback(() => {
    if (preview) {
      downloadFromPreview(preview);
      onDownload?.();
      onOpenChange(false);
    }
  }, [preview, onDownload, onOpenChange]);

  // Handle close
  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent size="full" className="overflow-hidden rounded-2xl">
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div>
              <AlertDialogHeader className="text-left">
                <AlertDialogTitle>Export Document</AlertDialogTitle>
                <AlertDialogDescription>
                  Select a format and preview your redacted document before downloading.
                </AlertDialogDescription>
              </AlertDialogHeader>
            </div>
            <Button variant="ghost" size="icon" onClick={handleClose}>
              <X size={20} />
            </Button>
          </div>

          {/* Format Selection */}
          <div className="flex gap-2 p-4 border-b border-border bg-muted/30">
            {FORMAT_OPTIONS.map(({ format, label, icon: Icon }) => (
              <Button
                key={format}
                variant={selectedFormat === format ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedFormat(format)}
                disabled={isGenerating}
              >
                <Icon size={16} data-icon="inline-start" />
                {label}
              </Button>
            ))}
          </div>

          {/* Preview Area */}
          <div className="flex-1 overflow-hidden bg-muted/20">
            {isGenerating ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-muted-foreground">
                  <SpinnerGap size={32} className="animate-spin" />
                  <span>Generating preview...</span>
                </div>
              </div>
            ) : error ? (
              <div className="flex items-center justify-center h-full">
                <div className="flex flex-col items-center gap-3 text-destructive">
                  <span>Error: {error}</span>
                  <Button variant="outline" size="sm" onClick={generatePreview}>
                    Try Again
                  </Button>
                </div>
              </div>
            ) : preview ? (
              <div className="h-full overflow-auto">
                {/* PDF Preview - iframe */}
                {preview.format === 'pdf' && (
                  <iframe
                    src={preview.blobUrl}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                )}

                {/* TXT Preview - pre element with Times New Roman */}
                {preview.format === 'txt' && preview.content && (
                  <div className="p-6 h-full overflow-auto">
                    <pre
                      className="whitespace-pre-wrap bg-white dark:bg-neutral-900 p-8 rounded-lg border border-border min-h-full w-full shadow-lg"
                      style={{
                        fontFamily: "'Times New Roman', Times, serif",
                        fontSize: '12pt',
                        lineHeight: '1.5'
                      }}
                    >
                      {preview.content}
                    </pre>
                  </div>
                )}

                {/* DOCX Preview - HTML representation */}
                {preview.format === 'docx' && preview.htmlPreview && (
                  <div className="p-6 h-full overflow-auto">
                    <div
                      className="bg-white shadow-lg rounded-lg overflow-hidden border border-border w-full max-w-none mx-auto"
                      style={{ minHeight: '100%' }}
                      dangerouslySetInnerHTML={{ __html: preview.htmlPreview }}
                    />
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* Footer */}
          <AlertDialogFooter className="p-4 border-t border-border bg-background">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {preview && (
                  <span>
                    {preview.fileName} ({(preview.blob.size / 1024).toFixed(1)} KB)
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  onClick={handleDownload}
                  disabled={!preview || isGenerating}
                >
                  <Download size={16} data-icon="inline-start" />
                  Download {selectedFormat.toUpperCase()}
                </Button>
              </div>
            </div>
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
