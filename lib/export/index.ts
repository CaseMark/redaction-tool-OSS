'use client';

import type { DetectedEntity } from '@/types/redaction';

// Export format types
export type ExportFormat = 'pdf' | 'docx' | 'txt';

// Export options following skill specification
export interface ExportOptions {
  format: ExportFormat;
  includeSpeakerLabels?: boolean;
  includeTimestamps?: boolean;
  headerText?: string;
  footerText?: string;
}

// Preview data structure
export interface ExportPreviewData {
  blobUrl: string;
  blob: Blob;
  fileName: string;
  format: ExportFormat;
  content?: string; // Plain text content (TXT only)
  htmlPreview?: string; // HTML representation (DOCX only)
}

// Document metadata for export
export interface ExportMetadata {
  fileName: string;
  processedAt: Date;
  totalEntities: number;
  redactedEntities: number;
}

// Constants following skill specification
const BRANDING_TEXT = 'CaseMark Redaction Tool';
const LINE_WIDTH = 72;

// Utility functions following skill specification
export function formatDate(dateString: string | Date): string {
  const date = typeof dateString === 'string' ? new Date(dateString) : dateString;
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Apply redactions to text
export function applyRedactions(text: string, entities: DetectedEntity[]): string {
  const entitiesToRedact = entities.filter(e => e.shouldRedact);
  let redactedText = text;

  // Sort entities by position in reverse order to maintain indices
  const sortedEntities = [...entitiesToRedact].sort((a, b) => b.startIndex - a.startIndex);

  for (const entity of sortedEntities) {
    redactedText =
      redactedText.slice(0, entity.startIndex) +
      entity.maskedValue +
      redactedText.slice(entity.endIndex);
  }

  return redactedText;
}

// Generate TXT export
function generateTxtExport(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata
): { content: string; blob: Blob } {
  const redactedText = applyRedactions(text, entities);
  const divider = '─'.repeat(LINE_WIDTH);
  const genDate = formatDate(new Date());
  const docDate = formatDate(metadata.processedAt);

  let content = '';

  // Header
  content += `${BRANDING_TEXT.padEnd(50)}${docDate}\n`;
  content += divider + '\n\n';

  // Title
  content += 'REDACTED DOCUMENT\n';
  content += `${metadata.fileName}\n\n`;

  // Summary
  content += `Redactions Applied: ${metadata.redactedEntities} of ${metadata.totalEntities} entities\n\n`;

  content += divider + '\n\n';

  // Content
  content += redactedText;

  content += '\n\n' + divider + '\n';

  // End marker
  content += '\n[END OF DOCUMENT]\n\n';

  content += divider + '\n';

  // Footer
  content += `${BRANDING_TEXT.padEnd(50)}Generated: ${genDate}\n`;

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });

  return { content, blob };
}

// Generate HTML preview for DOCX (rendered version of what the document looks like)
function generateDocxHtmlPreview(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata
): string {
  const redactedText = applyRedactions(text, entities);
  const genDate = formatDate(new Date());
  const docDate = formatDate(metadata.processedAt);

  // Escape HTML special characters
  const escapeHtml = (str: string) => {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;')
      .replace(/\n/g, '<br>');
  };

  return `
    <div style="font-family: 'Times New Roman', Times, serif; font-size: 12pt; line-height: 1.15; width: 100%; padding: 48px; background: white; color: black; box-sizing: border-box;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; font-size: 9pt; font-style: italic; color: #666; margin-bottom: 24pt; border-bottom: 1px solid #ccc; padding-bottom: 12pt;">
        <span>${BRANDING_TEXT}</span>
        <span>${docDate}</span>
      </div>

      <!-- Title -->
      <div style="text-align: center; margin-bottom: 24pt;">
        <div style="font-weight: bold; font-size: 12pt;">REDACTED DOCUMENT</div>
        <div style="margin-top: 8pt;">${escapeHtml(metadata.fileName)}</div>
        <div style="margin-top: 8pt; color: #666;">Redactions Applied: ${metadata.redactedEntities} of ${metadata.totalEntities} entities</div>
      </div>

      <!-- Divider -->
      <div style="border-bottom: 1px solid #ccc; margin-bottom: 24pt;"></div>

      <!-- Content -->
      <div style="white-space: pre-wrap; word-wrap: break-word;">
        ${escapeHtml(redactedText)}
      </div>

      <!-- End marker -->
      <div style="text-align: center; font-weight: bold; margin: 32pt 0 24pt 0;">
        [END OF DOCUMENT]
      </div>

      <!-- Divider -->
      <div style="border-bottom: 1px solid #ccc; margin-bottom: 12pt;"></div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; font-size: 9pt; font-style: italic; color: #666;">
        <span>${BRANDING_TEXT}</span>
        <span>Generated: ${genDate}</span>
      </div>
    </div>
  `;
}

// Generate DOCX export using the docx library
async function generateDocxExport(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata
): Promise<{ blob: Blob; htmlPreview: string }> {
  // Dynamically import docx to avoid SSR issues
  const { Document, Packer, Paragraph, TextRun, AlignmentType, BorderStyle, convertInchesToTwip, Header, Footer, PageNumber } = await import('docx');

  const redactedText = applyRedactions(text, entities);
  const genDate = formatDate(new Date());
  const docDate = formatDate(metadata.processedAt);

  // Build paragraphs for the document content
  const contentParagraphs = redactedText.split('\n').map(line =>
    new Paragraph({
      children: [
        new TextRun({
          text: line || ' ',
          font: 'Times New Roman',
          size: 24, // 12pt
        }),
      ],
      spacing: { after: 200, line: 276 }, // 1.15 line spacing
    })
  );

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1.25),
            right: convertInchesToTwip(1),
          },
        },
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: BRANDING_TEXT, italics: true, color: '666666', font: 'Times New Roman', size: 18 }),
                new TextRun({ text: '\t' }),
                new TextRun({ text: docDate, italics: true, color: '666666', font: 'Times New Roman', size: 18 }),
              ],
              tabStops: [{ type: 'right' as const, position: convertInchesToTwip(6.25) }],
            }),
          ],
        }),
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              children: [
                new TextRun({ text: BRANDING_TEXT, italics: true, color: '666666', font: 'Times New Roman', size: 18 }),
                new TextRun({ text: '\t' }),
                new TextRun({ text: `Generated: ${genDate}`, italics: true, color: '666666', font: 'Times New Roman', size: 18 }),
              ],
              tabStops: [{ type: 'right' as const, position: convertInchesToTwip(6.25) }],
            }),
            new Paragraph({
              children: [
                new TextRun({ text: 'Page ', font: 'Times New Roman', size: 18 }),
                new TextRun({ children: [PageNumber.CURRENT], font: 'Times New Roman', size: 18 }),
                new TextRun({ text: ' of ', font: 'Times New Roman', size: 18 }),
                new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Times New Roman', size: 18 }),
              ],
              alignment: AlignmentType.CENTER,
            }),
          ],
        }),
      },
      children: [
        // Title
        new Paragraph({
          children: [
            new TextRun({ text: 'REDACTED DOCUMENT', bold: true, font: 'Times New Roman', size: 24 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        // Document name
        new Paragraph({
          children: [
            new TextRun({ text: metadata.fileName, font: 'Times New Roman', size: 24 }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 200 },
        }),
        // Summary
        new Paragraph({
          children: [
            new TextRun({
              text: `Redactions Applied: ${metadata.redactedEntities} of ${metadata.totalEntities} entities`,
              font: 'Times New Roman',
              size: 24,
              color: '666666',
            }),
          ],
          alignment: AlignmentType.CENTER,
          spacing: { after: 400 },
        }),
        // Divider
        new Paragraph({
          border: {
            bottom: {
              color: 'CCCCCC',
              space: 1,
              style: BorderStyle.SINGLE,
              size: 6,
            },
          },
          spacing: { after: 400 },
        }),
        // Content
        ...contentParagraphs,
        // End marker
        new Paragraph({
          children: [new TextRun({ text: '[END OF DOCUMENT]', bold: true, font: 'Times New Roman', size: 24 })],
          alignment: AlignmentType.CENTER,
          spacing: { before: 400, after: 300 },
        }),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  const htmlPreview = generateDocxHtmlPreview(text, entities, metadata);

  return { blob, htmlPreview };
}

// Generate PDF export using jspdf
async function generatePdfExport(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata
): Promise<Blob> {
  // Dynamically import jsPDF to avoid SSR issues
  const { jsPDF } = await import('jspdf');

  const redactedText = applyRedactions(text, entities);
  const genDate = formatDate(new Date());
  const docDate = formatDate(metadata.processedAt);

  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
  });

  // Page dimensions
  const pageWidth = 612;
  const pageHeight = 792;
  const marginTop = 72;
  const marginBottom = 72;
  const marginLeft = 90;
  const marginRight = 72;
  const maxWidth = pageWidth - marginLeft - marginRight;

  // Font settings
  const fontSizeBody = 12;
  const fontSizeHeader = 9;
  const lineHeight = fontSizeBody * 1.4;

  let y = marginTop;

  // Helper to add new page
  const checkNewPage = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
      return true;
    }
    return false;
  };

  // Use Times font (built-in to jsPDF)
  doc.setFont('times', 'normal');

  // Header on first page
  doc.setFontSize(fontSizeHeader);
  doc.setTextColor(102, 102, 102);
  doc.setFont('times', 'italic');
  doc.text(BRANDING_TEXT, marginLeft, y);
  doc.text(docDate, pageWidth - marginRight, y, { align: 'right' });
  y += lineHeight * 2;

  // Header divider
  doc.setDrawColor(204, 204, 204);
  doc.setLineWidth(0.5);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += lineHeight;

  // Title
  doc.setFontSize(fontSizeBody);
  doc.setTextColor(0, 0, 0);
  doc.setFont('times', 'bold');
  const titleWidth = doc.getTextWidth('REDACTED DOCUMENT');
  doc.text('REDACTED DOCUMENT', (pageWidth - titleWidth) / 2, y);
  y += lineHeight;

  // Document name
  doc.setFont('times', 'normal');
  const nameWidth = doc.getTextWidth(metadata.fileName);
  doc.text(metadata.fileName, (pageWidth - nameWidth) / 2, y);
  y += lineHeight;

  // Summary
  doc.setTextColor(102, 102, 102);
  const summaryText = `Redactions Applied: ${metadata.redactedEntities} of ${metadata.totalEntities} entities`;
  const summaryWidth = doc.getTextWidth(summaryText);
  doc.text(summaryText, (pageWidth - summaryWidth) / 2, y);
  y += lineHeight * 2;

  // Content divider
  doc.setDrawColor(204, 204, 204);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += lineHeight * 1.5;

  // Content
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(fontSizeBody);
  doc.setFont('times', 'normal');

  const paragraphs = redactedText.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      y += lineHeight;
      checkNewPage(lineHeight);
      continue;
    }

    // Word wrap text
    const lines = doc.splitTextToSize(paragraph, maxWidth);

    for (const line of lines) {
      checkNewPage(lineHeight);
      doc.text(line, marginLeft, y);
      y += lineHeight;
    }
  }

  // End marker
  y += lineHeight;
  checkNewPage(lineHeight * 4);
  doc.setDrawColor(204, 204, 204);
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += lineHeight * 1.5;

  doc.setFont('times', 'bold');
  const endText = '[END OF DOCUMENT]';
  const endWidth = doc.getTextWidth(endText);
  doc.text(endText, (pageWidth - endWidth) / 2, y);
  y += lineHeight * 2;

  // Footer divider
  doc.line(marginLeft, y, pageWidth - marginRight, y);
  y += lineHeight;

  // Footer
  doc.setFont('times', 'italic');
  doc.setFontSize(fontSizeHeader);
  doc.setTextColor(102, 102, 102);
  doc.text(BRANDING_TEXT, marginLeft, y);
  doc.text(`Generated: ${genDate}`, pageWidth - marginRight, y, { align: 'right' });

  // Add page numbers to all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('times', 'normal');
    doc.setFontSize(fontSizeHeader);
    doc.setTextColor(102, 102, 102);
    const pageText = `Page ${i} of ${totalPages}`;
    const pageTextWidth = doc.getTextWidth(pageText);
    doc.text(pageText, (pageWidth - pageTextWidth) / 2, pageHeight - 36);
  }

  return doc.output('blob');
}

// Generate preview for any format
export async function generateExportPreview(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata,
  options: ExportOptions
): Promise<ExportPreviewData> {
  const baseName = sanitizeFilename(metadata.fileName.replace(/\.[^.]+$/, ''));
  const timestamp = new Date().toISOString().split('T')[0];

  let blob: Blob;
  let content: string | undefined;
  let htmlPreview: string | undefined;

  switch (options.format) {
    case 'txt': {
      const txtResult = generateTxtExport(text, entities, metadata);
      blob = txtResult.blob;
      content = txtResult.content;
      break;
    }
    case 'docx': {
      const docxResult = await generateDocxExport(text, entities, metadata);
      blob = docxResult.blob;
      htmlPreview = docxResult.htmlPreview;
      break;
    }
    case 'pdf':
    default: {
      blob = await generatePdfExport(text, entities, metadata);
      break;
    }
  }

  const blobUrl = URL.createObjectURL(blob);
  const fileName = `${baseName}_redacted_${timestamp}.${options.format}`;

  return {
    blobUrl,
    blob,
    fileName,
    format: options.format,
    content,
    htmlPreview,
  };
}

// Direct export (downloads immediately)
export async function exportDocument(
  text: string,
  entities: DetectedEntity[],
  metadata: ExportMetadata,
  options: ExportOptions
): Promise<void> {
  const preview = await generateExportPreview(text, entities, metadata, options);
  downloadFromPreview(preview);
}

// Download from preview data
export function downloadFromPreview(preview: ExportPreviewData): void {
  const link = document.createElement('a');
  link.href = preview.blobUrl;
  link.download = preview.fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up blob URL after a short delay
  setTimeout(() => {
    URL.revokeObjectURL(preview.blobUrl);
  }, 100);
}

// Clean up preview blob URL (call when done with preview)
export function cleanupPreview(preview: ExportPreviewData): void {
  URL.revokeObjectURL(preview.blobUrl);
}
