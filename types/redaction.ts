// PII Entity Types
export type EntityType =
  | 'ssn'
  | 'account_number'
  | 'credit_card'
  | 'name'
  | 'address'
  | 'phone'
  | 'email'
  | 'date_of_birth'
  | 'custom';

// Detection methods
export type DetectionMethod = 'regex' | 'llm' | 'retrospective' | 'vault_semantic' | 'manual';

// Detected PII entity
export interface DetectedEntity {
  id: string;
  type: EntityType;
  value: string;
  maskedValue: string;
  confidence: number;
  method: DetectionMethod;
  startIndex: number;
  endIndex: number;
  context?: string;
  pageNumber?: number;
  shouldRedact: boolean;
}

// Entity configuration for UI
export interface EntityConfig {
  type: EntityType;
  label: string;
  description: string;
  pattern?: RegExp;
  examples?: string[];
}

// Preset redaction configurations
export interface RedactionPreset {
  id: string;
  label: string;
  description: string;
  entityTypes: EntityType[];
}

// Document for processing
export interface ProcessedDocument {
  id: string;
  fileName: string;
  fileType: 'pdf' | 'docx' | 'txt' | 'image';
  fileSize: number;
  text: string;
  extractionMethod: 'direct' | 'ocr';
  uploadedAt: Date;
  status: 'uploading' | 'extracting' | 'ready' | 'processing' | 'completed' | 'failed';
  error?: string;
}

// Detection request
export interface DetectPIIRequest {
  text: string;
  entityTypes: EntityType[];
  documentId?: string;
  vaultId?: string;
}

// Detection response
export interface DetectPIIResponse {
  entities: DetectedEntity[];
  totalMatches: number;
  processingTime: number;
  methods: DetectionMethod[];
}

// Export format type
export type ExportFormat = 'pdf' | 'docx' | 'txt';

// Export options
export interface ExportOptions {
  format: ExportFormat;
  includeSpeakerLabels?: boolean;
  includeTimestamps?: boolean;
  headerText?: string;
  footerText?: string;
}

// Export preview data
export interface ExportPreviewData {
  blobUrl: string;
  blob: Blob;
  fileName: string;
  format: ExportFormat;
  content?: string; // Plain text content (TXT only)
  htmlPreview?: string; // HTML representation (DOCX only)
}

// Export request (legacy - keeping for API compatibility)
export interface ExportPDFRequest {
  text: string;
  entities: DetectedEntity[];
  filename: string;
}

// Workflow step
export type WorkflowStep = 'upload' | 'configure' | 'review' | 'export';

// Redaction session state
export interface RedactionSession {
  id: string;
  step: WorkflowStep;
  document: ProcessedDocument | null;
  selectedEntityTypes: EntityType[];
  detectedEntities: DetectedEntity[];
  isProcessing: boolean;
  exportUrl?: string;
}

// Audit log entry
export interface AuditLogEntry {
  timestamp: Date;
  action: string;
  entityType?: EntityType;
  originalValue?: string;
  redactedValue?: string;
  details?: Record<string, unknown>;
}

// Audit log for export
export interface RedactionAuditLog {
  documentName: string;
  processedAt: Date;
  totalEntities: number;
  redactedEntities: number;
  entityBreakdown: Record<EntityType, number>;
  entries: AuditLogEntry[];
}
