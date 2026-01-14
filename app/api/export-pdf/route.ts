import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import type { DetectedEntity } from '@/types/redaction';

interface ExportPDFRequestBody {
  text: string;
  entities: DetectedEntity[];
  filename: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: ExportPDFRequestBody = await request.json();

    // Validate request
    if (!body.text || typeof body.text !== 'string') {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      );
    }

    if (!body.entities || !Array.isArray(body.entities)) {
      return NextResponse.json(
        { error: 'Entities array is required' },
        { status: 400 }
      );
    }

    const filename = body.filename || 'redacted-document.pdf';

    // Filter entities that should be redacted
    const entitiesToRedact = body.entities.filter(e => e.shouldRedact);

    // Apply redactions to text
    let redactedText = body.text;

    // Sort entities by position in reverse order to maintain indices
    const sortedEntities = [...entitiesToRedact].sort((a, b) => b.startIndex - a.startIndex);

    for (const entity of sortedEntities) {
      // Replace using exact indices for precision
      redactedText =
        redactedText.slice(0, entity.startIndex) +
        entity.maskedValue +
        redactedText.slice(entity.endIndex);
    }

    // Create PDF document
    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Courier);

    // Page settings
    const fontSize = 10;
    const lineHeight = fontSize * 1.4;
    const margin = 50;
    const pageWidth = 612; // US Letter
    const pageHeight = 792;
    const maxWidth = pageWidth - (margin * 2);
    const maxLinesPerPage = Math.floor((pageHeight - (margin * 2)) / lineHeight);

    // Word wrap text into lines
    const lines: string[] = [];
    const paragraphs = redactedText.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        const testLine = currentLine ? `${currentLine} ${word}` : word;
        const textWidth = font.widthOfTextAtSize(testLine, fontSize);

        if (textWidth > maxWidth && currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          currentLine = testLine;
        }
      }

      if (currentLine) {
        lines.push(currentLine);
      }
    }

    // Create pages and add content
    let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    let yPosition = pageHeight - margin;
    let lineCount = 0;

    // Header
    currentPage.drawText('REDACTED DOCUMENT', {
      x: margin,
      y: yPosition,
      size: 14,
      font,
      color: rgb(0, 0, 0),
    });
    yPosition -= lineHeight * 2;
    lineCount += 2;

    // Summary
    const summaryText = `Redactions applied: ${entitiesToRedact.length}`;
    currentPage.drawText(summaryText, {
      x: margin,
      y: yPosition,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });
    yPosition -= lineHeight * 2;
    lineCount += 2;

    // Separator line
    currentPage.drawLine({
      start: { x: margin, y: yPosition + lineHeight / 2 },
      end: { x: pageWidth - margin, y: yPosition + lineHeight / 2 },
      thickness: 0.5,
      color: rgb(0.7, 0.7, 0.7),
    });
    yPosition -= lineHeight;
    lineCount += 1;

    // Add text content
    for (const line of lines) {
      // Check if we need a new page
      if (lineCount >= maxLinesPerPage - 2) {
        // Add page number
        currentPage.drawText(`Page ${pdfDoc.getPageCount()}`, {
          x: pageWidth / 2 - 20,
          y: margin / 2,
          size: 8,
          font,
          color: rgb(0.5, 0.5, 0.5),
        });

        // Create new page
        currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
        yPosition = pageHeight - margin;
        lineCount = 0;
      }

      currentPage.drawText(line, {
        x: margin,
        y: yPosition,
        size: fontSize,
        font,
        color: rgb(0, 0, 0),
      });

      yPosition -= lineHeight;
      lineCount++;
    }

    // Add page number to last page
    currentPage.drawText(`Page ${pdfDoc.getPageCount()}`, {
      x: pageWidth / 2 - 20,
      y: margin / 2,
      size: 8,
      font,
      color: rgb(0.5, 0.5, 0.5),
    });

    // Generate PDF bytes
    const pdfBytes = await pdfDoc.save();
    const buffer = Buffer.from(pdfBytes);

    // Return PDF as downloadable file
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('PDF export error:', error);
    const message = error instanceof Error ? error.message : 'PDF export failed';
    return NextResponse.json(
      { error: 'PDF export failed', details: message },
      { status: 500 }
    );
  }
}
