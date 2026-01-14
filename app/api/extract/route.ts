import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storeFile, deleteFile } from '@/lib/file-store';

export const maxDuration = 120; // Allow up to 2 minutes for OCR processing

const CASEDEV_API_URL = process.env.CASEDEV_API_URL || 'https://api.case.dev';
const CASEDEV_API_KEY = process.env.CASEDEV_API_KEY;

export async function POST(request: NextRequest) {
  let fileId: string | null = null;

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const fileName = file.name.toLowerCase();
    const fileType = file.type;

    // TXT files: read directly without OCR
    if (fileType === 'text/plain' || fileName.endsWith('.txt')) {
      const text = await file.text();
      return NextResponse.json({
        text,
        fileName: file.name,
        fileType: 'txt',
        method: 'direct',
      });
    }

    // PDF/DOCX/Images: require Case.dev API key
    if (!CASEDEV_API_KEY) {
      return NextResponse.json(
        { error: 'CASEDEV_API_KEY is required for PDF/DOCX/image files. Use TXT files for local development.' },
        { status: 500 }
      );
    }

    // Check for Vercel Blob for file storage
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'PDF/DOCX/image extraction requires Vercel Blob storage. Use TXT files for local development.' },
        { status: 400 }
      );
    }

    // Validate file type
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isDOCX =
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx');
    const isImage =
      fileType.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|tiff|bmp)$/i.test(fileName);

    if (!isPDF && !isDOCX && !isImage) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF, DOCX, TXT, or image files.' },
        { status: 400 }
      );
    }

    // Generate ID and prepare file
    fileId = crypto.randomUUID();
    const buffer = await file.arrayBuffer();

    // Fix MIME type if needed
    let mimeType = file.type;
    if (!mimeType || mimeType === 'application/octet-stream') {
      if (file.name.endsWith('.pdf')) mimeType = 'application/pdf';
      else if (file.name.endsWith('.docx'))
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      else if (/\.jpe?g$/i.test(file.name)) mimeType = 'image/jpeg';
      else if (/\.png$/i.test(file.name)) mimeType = 'image/png';
    }

    // Upload to Vercel Blob
    const fileUrl = await storeFile(fileId, buffer, mimeType, file.name);

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'Failed to upload file to storage.' },
        { status: 500 }
      );
    }

    // Submit to Case.dev OCR
    const submitResponse = await fetch(`${CASEDEV_API_URL}/ocr/v1/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${CASEDEV_API_KEY}`,
      },
      body: JSON.stringify({
        document_url: fileUrl,
      }),
    });

    if (!submitResponse.ok) {
      const errorText = await submitResponse.text();
      await deleteFile(fileId);
      return NextResponse.json(
        { error: `OCR submission failed: ${errorText}` },
        { status: 500 }
      );
    }

    const submitResult = await submitResponse.json();
    const jobId = submitResult.job_id || submitResult.id || submitResult.jobId;

    if (!jobId) {
      await deleteFile(fileId);
      return NextResponse.json(
        { error: 'OCR service did not return a job ID' },
        { status: 500 }
      );
    }

    // Poll for completion (max 90 seconds)
    const statusUrl = `${CASEDEV_API_URL}/ocr/v1/${jobId}`;
    const maxAttempts = 45;
    const pollInterval = 2000;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const statusResponse = await fetch(statusUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${CASEDEV_API_KEY}` },
      });

      if (!statusResponse.ok) continue;

      const status = await statusResponse.json();

      if (status.status === 'completed') {
        await deleteFile(fileId);

        let text = status.text || status.result?.text;

        // Try text endpoint if not in status response
        if (!text) {
          const textUrl = `${CASEDEV_API_URL}/ocr/v1/${jobId}/text`;
          const textResponse = await fetch(textUrl, {
            method: 'GET',
            headers: { Authorization: `Bearer ${CASEDEV_API_KEY}` },
          });
          if (textResponse.ok) {
            text = await textResponse.text();
          }
        }

        if (!text) {
          return NextResponse.json(
            { error: 'OCR completed but no text returned' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          text,
          fileName: file.name,
          fileType: isPDF ? 'pdf' : isDOCX ? 'docx' : 'image',
          method: 'ocr',
        });
      }

      if (status.status === 'failed') {
        await deleteFile(fileId);
        const errorMsg = status.error || status.message || 'Unknown error';
        return NextResponse.json(
          { error: `OCR processing failed: ${errorMsg}` },
          { status: 500 }
        );
      }
    }

    // Timeout
    await deleteFile(fileId);
    return NextResponse.json(
      { error: 'OCR processing timed out.' },
      { status: 504 }
    );
  } catch (error) {
    if (fileId) await deleteFile(fileId);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unexpected error' },
      { status: 500 }
    );
  }
}
