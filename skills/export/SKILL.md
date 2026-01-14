---
# Do not remove this header. Agents read it.
description: |
  Agents: Always follow this skill when implementing export functionality for documents.
  This covers PDF, Word (DOCX), and plain text (TXT) exports with consistent legal-style formatting.
  Use the established patterns for margins, typography, headers, and document structure.
---

# Export Skill

## Purpose

Provide consistent, professional document export functionality across the application. This skill defines standards for generating PDF, Word, and plain text exports with proper legal-style formatting suitable for court documents, reports, redactions, and other professional outputs.

## Key Files

- `lib/export/index.ts` — Core export utilities and formatting logic
- `types/recording.ts` — Export types and options interface

## Quick Reference

```typescript
import { exportTranscript, generateExportPreview, downloadFromPreview } from '@/lib/export';

// Direct export (downloads immediately)
await exportTranscript(data, segments, metadata, {
  format: 'pdf', // 'pdf' | 'docx' | 'txt'
  includeSpeakerLabels: true,
  includeTimestamps: true,
});

// Preview workflow (show before download)
const preview = await generateExportPreview(data, segments, metadata, options);
// preview.blobUrl - URL for iframe/display
// preview.htmlPreview - HTML content for DOCX preview
// preview.content - Text content for TXT preview
downloadFromPreview(preview);
```

## Document Standards

### Page Layout (Legal Standard)

| Property | Value | Notes |
|----------|-------|-------|
| Page Size | Letter (8.5" x 11") | US standard |
| Top Margin | 1 inch | 72 points |
| Bottom Margin | 1 inch | 72 points |
| Left Margin | 1.25 inches | 90 points |
| Right Margin | 1 inch | 72 points |

```typescript
// Constants for export implementations
const MARGIN_TOP = 1;      // inches
const MARGIN_BOTTOM = 1;   // inches
const MARGIN_LEFT = 1.25;  // inches
const MARGIN_RIGHT = 1;    // inches
```

### Typography

| Element | Font | Size | Style |
|---------|------|------|-------|
| Body Text | Times New Roman | 12pt | Normal |
| Titles | Times New Roman | 12pt | Bold |
| Headers/Footers | Times New Roman | 9pt | Italic |
| Timestamps | Times New Roman | 12pt | Normal, Muted color |
| Labels | Times New Roman | 12pt | Bold |

```typescript
const FONT_FAMILY = 'Times New Roman';
const FONT_SIZE_TITLE = 12;
const FONT_SIZE_BODY = 12;
const FONT_SIZE_FOOTER = 9;
const LINE_SPACING = 1.15; // Single or 1.15
```

### Document Structure

Every export document follows this structure:

```
┌─────────────────────────────────────────────────┐
│ [Header Row]                                    │
│ Left: Branding          Right: Date             │
├─────────────────────────────────────────────────┤
│                                                 │
│              DOCUMENT TITLE                     │
│              Document Name                      │
│              Duration/Metadata                  │
│                                                 │
│ SECTION HEADER (e.g., SPEAKERS, PARTIES)        │
│   1. Item One                                   │
│   2. Item Two                                   │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│ [Main Content]                                  │
│ [TIMESTAMP] LABEL: Content text here...         │
│                                                 │
│ [TIMESTAMP] LABEL: More content...              │
│                                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│              [END MARKER]                       │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Footer Row]                                    │
│ Left: Branding          Right: Generated Date   │
│                                                 │
│              Page X of Y                        │
└─────────────────────────────────────────────────┘
```

### Header/Footer Pattern

Headers and footers use left/right alignment:

```typescript
// Header: Branding left, document date right
// Footer: Branding left, generation date right

// For Word (DOCX) - use tab stops
new Paragraph({
  children: [
    new TextRun({ text: BRANDING_TEXT, italics: true, color: '666666' }),
    new TextRun({ text: '\t' }),
    new TextRun({ text: dateText, italics: true, color: '666666' }),
  ],
  tabStops: [{ type: 'right', position: convertInchesToTwip(6.25) }],
});

// For PDF - use text alignment
doc.text(BRANDING_TEXT, marginLeft, y);
doc.text(dateText, pageWidth - marginRight, y, { align: 'right' });

// For TXT - use padding
`${BRANDING_TEXT.padEnd(50)}${dateText}`
```

### Content Formatting

#### Labeled Content (Speaker Attribution, Field Labels)

```
[TIMESTAMP] LABEL: Content on the same line as label...
```

- Timestamp in brackets, muted color
- Label in bold, followed by colon
- Content starts on same line, wraps below if needed
- New paragraph for each labeled section

```typescript
// Word example
new Paragraph({
  children: [
    new TextRun({ text: `[${timestamp}] `, color: '666666' }),
    new TextRun({ text: `${label}: `, bold: true }),
    new TextRun({ text: content }),
  ],
  spacing: { after: 200, line: 276 }, // 1.15 line spacing
});
```

#### Section Markers

Use centered, bold markers for document sections:

```typescript
// End of document marker
new Paragraph({
  children: [new TextRun({ text: '[END OF DOCUMENT]', bold: true })],
  alignment: AlignmentType.CENTER,
  spacing: { before: 400, after: 300 },
});
```

### Dividers

Use horizontal rules to separate document sections:

```typescript
// Word - border on paragraph
border: {
  bottom: {
    color: 'CCCCCC',
    space: 1,
    style: BorderStyle.SINGLE,
    size: 6,
  },
}

// PDF - line drawing
doc.setDrawColor('#CCCCCC');
doc.setLineWidth(0.5);
doc.line(marginLeft, y, pageWidth - marginRight, y);

// TXT - character repeat
const divider = '─'.repeat(72);
```

## Format-Specific Implementation

### PDF Export (jsPDF)

```typescript
import { jsPDF } from 'jspdf';

const doc = new jsPDF({
  unit: 'pt',
  format: 'letter',
});

// Margins in points (72 points = 1 inch)
const marginTop = 72;
const marginBottom = 72;
const marginLeft = 90;
const marginRight = 72;

// Text wrapping
const maxWidth = pageWidth - marginLeft - marginRight;
const lines = doc.splitTextToSize(text, maxWidth);

// Page breaks
if (y + lineHeight > pageHeight - marginBottom) {
  doc.addPage();
  y = marginTop;
}

// Page numbers (add after content)
const totalPages = doc.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, pageHeight - 36, { align: 'center' });
}
```

### Word Export (docx)

```typescript
import { Document, Packer, Paragraph, TextRun, AlignmentType, convertInchesToTwip } from 'docx';

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
    children: paragraphs,
  }],
});

const blob = await Packer.toBlob(doc);
```

### Plain Text Export

```typescript
// Use consistent line width (72 chars typical)
const LINE_WIDTH = 72;

// Structure with dividers
let content = '';
content += `${branding.padEnd(50)}${date}\n`;
content += '─'.repeat(LINE_WIDTH) + '\n\n';
content += 'TITLE\n';
// ... content
content += '\n' + '─'.repeat(LINE_WIDTH) + '\n';
content += `${branding.padEnd(50)}Generated: ${genDate}\n`;
```

## Preview Workflow

All exports should support a preview-before-download workflow:

1. **Generate Preview** — Create blob and preview content
2. **Display Preview** — Show in modal with format-appropriate viewer
3. **Download** — User confirms and downloads

```typescript
interface ExportPreviewData {
  blobUrl: string;      // URL.createObjectURL for the blob
  blob: Blob;           // The actual file data
  fileName: string;     // Suggested filename
  format: 'txt' | 'docx' | 'pdf';
  content?: string;     // Plain text content (TXT only)
  htmlPreview?: string; // HTML representation (DOCX only)
}

// PDF: Display in iframe
<iframe src={preview.blobUrl} />

// TXT: Display in pre element
<pre>{preview.content}</pre>

// DOCX: Display HTML preview that mirrors document structure
<div dangerouslySetInnerHTML={{ __html: preview.htmlPreview }} />
```

## Export Options Interface

```typescript
interface ExportOptions {
  format: 'pdf' | 'docx' | 'txt';
  includeSpeakerLabels: boolean;  // Include attribution labels
  includeTimestamps: boolean;     // Include time markers
  headerText?: string;            // Custom header text
  footerText?: string;            // Custom footer text
}
```

## Utility Functions

### Time Formatting

```typescript
function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}
```

### Duration Formatting

```typescript
function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m ${secs}s`;
  }
  return `${mins}m ${secs}s`;
}
```

### Date Formatting

```typescript
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}
```

### Filename Sanitization

```typescript
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
}

// Usage
const fileName = `${sanitizeFilename(docName)}_${type}_${timestamp}.${format}`;
```

## Dependencies

```json
{
  "jspdf": "^2.5.1",
  "docx": "^8.2.0",
  "file-saver": "^2.0.5"
}
```

## Checklist

When implementing export functionality:

- [ ] Uses correct margins (Top 1", Bottom 1", Left 1.25", Right 1")
- [ ] Uses Times New Roman font family
- [ ] Header has left/right alignment (branding + date)
- [ ] Footer has left/right alignment (branding + generated date)
- [ ] Page numbers centered at bottom
- [ ] Proper divider lines between sections
- [ ] Labels bold with colon, content on same line
- [ ] Timestamps in brackets with muted styling
- [ ] End marker centered and bold
- [ ] Preview workflow implemented for all formats
- [ ] Filename uses sanitized document name + timestamp
