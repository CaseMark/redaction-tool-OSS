'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  CloudArrowUp,
  File,
  FileText,
  FilePdf,
  FileDoc,
  Image,
  X,
  SpinnerGap,
  CheckCircle,
  WarningCircle,
} from '@phosphor-icons/react';
import type { ProcessedDocument } from '@/types/redaction';
import { useUsage, useUsageCheck } from '@/lib/contexts/usage-context';

interface FileUploadProps {
  onFileProcessed: (document: ProcessedDocument) => void;
  isProcessing: boolean;
}

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
  'text/plain': ['.txt'],
  'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
};

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function FileUpload({ onFileProcessed, isProcessing }: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'extracting' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Usage tracking
  const { recordUsage } = useUsage();
  const { canMakeApiCall } = useUsageCheck();

  const getFileIcon = (fileType: string) => {
    if (fileType.includes('pdf')) return FilePdf;
    if (fileType.includes('word') || fileType.includes('docx')) return FileDoc;
    if (fileType.startsWith('image/')) return Image;
    if (fileType === 'text/plain') return FileText;
    return File;
  };

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_FILE_SIZE) {
      return `File size exceeds ${MAX_FILE_SIZE / 1024 / 1024}MB limit`;
    }

    const validTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'text/plain',
    ];

    const isValidType =
      validTypes.includes(file.type) ||
      file.type.startsWith('image/') ||
      file.name.endsWith('.txt') ||
      file.name.endsWith('.pdf') ||
      file.name.endsWith('.docx');

    if (!isValidType) {
      return 'Invalid file type. Upload PDF, DOCX, TXT, or image files.';
    }

    return null;
  };

  const processFile = useCallback(async (file: File) => {
    setError(null);

    // Check usage limits
    if (!canMakeApiCall) {
      setError('Demo usage limit reached. Please upgrade to continue.');
      setUploadStatus('error');
      return;
    }

    // Validate
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      setUploadStatus('error');
      return;
    }

    setUploadStatus('uploading');
    setProgress('Uploading file...');

    try {
      // Create FormData
      const formData = new FormData();
      formData.append('file', file);

      setUploadStatus('extracting');
      setProgress('Extracting text from document...');

      // Send to extraction API
      const response = await fetch('/api/extract', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to extract text from document');
      }

      const result = await response.json();

      // Record OCR usage if applicable
      if (result.usage?.ocrPages) {
        recordUsage('/api/extract', { ocrPages: result.usage.ocrPages });
      }

      // Create processed document
      const processedDocument: ProcessedDocument = {
        id: crypto.randomUUID(),
        fileName: file.name,
        fileType: result.fileType,
        fileSize: file.size,
        text: result.text,
        extractionMethod: result.method,
        uploadedAt: new Date(),
        status: 'ready',
      };

      setUploadStatus('success');
      setProgress('Document processed successfully!');

      // Brief delay to show success state
      setTimeout(() => {
        onFileProcessed(processedDocument);
      }, 500);
    } catch (err) {
      console.error('File processing error:', err);
      setError(err instanceof Error ? err.message : 'Failed to process file');
      setUploadStatus('error');
    }
  }, [onFileProcessed, canMakeApiCall, recordUsage]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);

      const file = e.dataTransfer.files[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        processFile(file);
      }
    },
    [processFile]
  );

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const resetUpload = () => {
    setUploadStatus('idle');
    setError(null);
    setProgress('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative overflow-hidden rounded-lg border bg-card transition-all duration-200 ${
          isDragging
            ? 'border-primary bg-primary/5'
            : uploadStatus === 'error'
            ? 'border-destructive'
            : 'border-border hover:border-foreground/20'
        }`}
      >
        <div
          className="flex min-h-[300px] flex-col items-center justify-center p-8"
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          {uploadStatus === 'idle' && (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CloudArrowUp size={32} className="text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-medium">
                {isDragging ? 'Drop your file here' : 'Upload a document'}
              </h3>
              <p className="mb-4 text-center text-sm text-muted-foreground">
                Drag and drop your document here, or click to browse
              </p>
              <Button onClick={handleBrowseClick} disabled={isProcessing}>
                Browse Files
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                Supported formats: PDF, DOCX, TXT, Images (JPG, PNG)
              </p>
              <p className="text-xs text-muted-foreground">
                Maximum file size: 50MB
              </p>
            </>
          )}

          {(uploadStatus === 'uploading' || uploadStatus === 'extracting') && (
            <>
              <div className="mb-4">
                <SpinnerGap size={48} className="animate-spin text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Processing document...</h3>
              <p className="text-sm text-muted-foreground">{progress}</p>
            </>
          )}

          {uploadStatus === 'success' && (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                <CheckCircle size={32} weight="fill" className="text-primary" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Success!</h3>
              <p className="text-sm text-muted-foreground">{progress}</p>
            </>
          )}

          {uploadStatus === 'error' && (
            <>
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <WarningCircle size={32} className="text-destructive" />
              </div>
              <h3 className="mb-2 text-lg font-medium">Upload Failed</h3>
              <p className="mb-4 text-sm text-destructive">{error}</p>
              <Button variant="outline" onClick={resetUpload}>
                Try Again
              </Button>
            </>
          )}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain,image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      {/* Help text */}
      <div className="rounded-lg border border-border bg-card p-4">
        <h4 className="mb-2 text-sm font-medium">Tips for best results:</h4>
        <ul className="space-y-1 text-xs text-muted-foreground">
          <li>Use high-quality scans for best OCR results</li>
          <li>Text files (.txt) are processed instantly</li>
          <li>PDFs and images require OCR processing (may take longer)</li>
          <li>For development without API keys, use .txt files</li>
        </ul>
      </div>
    </div>
  );
}
