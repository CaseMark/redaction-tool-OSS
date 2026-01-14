# OCR Integration with Case.dev and Vercel Blob

This skill documents how to implement OCR (Optical Character Recognition) for PDF and DOCX files using the Case.dev OCR API with Vercel Blob for file storage.

## Overview

Case.dev OCR requires a publicly accessible `document_url` - it cannot accept direct file uploads. This implementation uses Vercel Blob to temporarily store files and provide public URLs.

## Architecture

```
User uploads file
        │
        ▼
┌──────────────────┐
│ /api/extract     │
│ (Next.js Route)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐     Upload file      ┌──────────────────┐
│ storeFile()      │ ──────────────────▶  │ Vercel Blob      │
│                  │     Returns URL      │ (Public Storage) │
└────────┬─────────┘                      └──────────────────┘
         │                                         ▲
         ▼                                         │
┌──────────────────┐     Fetches file     ┌───────┴──────────┐
│ Case.dev OCR API │ ◀────────────────────│ document_url     │
│ /ocr/v1/process  │                      │ from Blob        │
└────────┬─────────┘                      └──────────────────┘
         │
         ▼
   Returns extracted text
```

## Prerequisites

- `@vercel/blob` package installed
- `CASEDEV_API_KEY` environment variable
- `BLOB_READ_WRITE_TOKEN` (auto-provided by Vercel when Blob store is connected)

## Implementation

### 1. File Store Module

Create `lib/file-store.ts`:

```typescript
import { put, del } from '@vercel/blob';

interface StoredFile {
  buffer: ArrayBuffer;
  mimeType: string;
  filename: string;
  createdAt: number;
}

interface BlobReference {
  url: string;
  pathname: string;
}

// In-memory store for local development fallback
const localFileStore = new Map<string, StoredFile>();

// Track blob URLs for cleanup
const blobStore = new Map<string, BlobReference>();

// TTL for stored files (5 minutes - enough for OCR processing)
const FILE_TTL_MS = 5 * 60 * 1000;

function isBlobConfigured(): boolean {
  return !!process.env.BLOB_READ_WRITE_TOKEN;
}

/**
 * Store a file and return its public URL
 * Returns null if Blob is not configured (local dev)
 */
export async function storeFile(
  id: string,
  buffer: ArrayBuffer,
  mimeType: string,
  filename: string
): Promise<string | null> {
  if (isBlobConfigured()) {
    const blob = await put(`temp/${id}/${filename}`, buffer, {
      access: 'public',
      contentType: mimeType,
    });

    blobStore.set(id, {
      url: blob.url,
      pathname: `temp/${id}/${filename}`,
    });

    // Schedule cleanup
    setTimeout(() => {
      deleteFile(id);
    }, FILE_TTL_MS);

    return blob.url;
  }

  // Local development: in-memory storage (won't work for OCR)
  localFileStore.set(id, {
    buffer,
    mimeType,
    filename,
    createdAt: Date.now(),
  });

  setTimeout(() => {
    localFileStore.delete(id);
  }, FILE_TTL_MS);

  return null;
}

/**
 * Retrieve a stored file (local development only)
 */
export function getFile(id: string): StoredFile | null {
  const file = localFileStore.get(id);
  if (!file) return null;
  if (Date.now() - file.createdAt > FILE_TTL_MS) {
    localFileStore.delete(id);
    return null;
  }
  return file;
}

/**
 * Delete a stored file from Blob storage
 */
export async function deleteFile(id: string): Promise<void> {
  const blobRef = blobStore.get(id);
  if (blobRef) {
    try {
      await del(blobRef.url);
    } catch {
      // Ignore deletion errors
    }
    blobStore.delete(id);
  }
  localFileStore.delete(id);
}

/**
 * Get the public URL for a stored file
 */
export function getFileUrl(id: string): string | null {
  return blobStore.get(id)?.url ?? null;
}
```

### 2. OCR Extraction Route

Create `app/api/contracts/extract/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { storeFile, deleteFile } from '@/lib/file-store';

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

    // PDF/DOCX: require Case.dev API key
    if (!CASEDEV_API_KEY) {
      return NextResponse.json(
        { error: 'CASEDEV_API_KEY is required for PDF/DOCX files.' },
        { status: 500 }
      );
    }

    // Require Vercel Blob for file storage
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        { error: 'PDF/DOCX extraction requires Vercel Blob. Use TXT files for local development.' },
        { status: 400 }
      );
    }

    // Validate file type
    const isPDF = fileType === 'application/pdf' || fileName.endsWith('.pdf');
    const isDOCX =
      fileType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx');

    if (!isPDF && !isDOCX) {
      return NextResponse.json(
        { error: 'Unsupported file type. Upload PDF, DOCX, or TXT.' },
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
          fileType: isPDF ? 'pdf' : 'docx',
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
```

### 3. Middleware Configuration

Ensure `/api/files` is public in `middleware.ts` (for local dev fallback):

```typescript
const publicRoutes = [
  "/api/auth",
  "/api/files",  // File serving for external services
];
```

## Environment Variables

| Variable | Where | Description |
|----------|-------|-------------|
| `CASEDEV_API_KEY` | All environments | Case.dev API key |
| `CASEDEV_API_URL` | Optional | Defaults to `https://api.case.dev` |
| `BLOB_READ_WRITE_TOKEN` | Production | Auto-provided by Vercel when Blob store is connected |

## Vercel Blob Setup

1. Go to Vercel Dashboard → Your Project → Storage
2. Click "Create Database" → Select "Blob"
3. Name it (e.g., "ocr-temp-files")
4. Click "Connect"
5. Deploy - the token is automatically injected

## Case.dev OCR API Reference

### Submit Document
```
POST /ocr/v1/process
Authorization: Bearer {CASEDEV_API_KEY}
Content-Type: application/json

{
  "document_url": "https://xyz.public.blob.vercel-storage.com/temp/..."
}
```

### Check Status
```
GET /ocr/v1/{jobId}
Authorization: Bearer {CASEDEV_API_KEY}
```

Response:
```json
{
  "status": "completed" | "processing" | "failed",
  "text": "Extracted document text...",
  "error": "Error message if failed"
}
```

### Get Text (alternate)
```
GET /ocr/v1/{jobId}/text
Authorization: Bearer {CASEDEV_API_KEY}
```

## Local Development

OCR is **not available** locally without `BLOB_READ_WRITE_TOKEN`. Options:

1. **Use TXT files** - Bypasses OCR entirely, reads directly
2. **Add Blob token locally** - Copy from Vercel dashboard to `.env.local`

```bash
# .env.local (optional, for local OCR testing)
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

## Response Format

```typescript
interface ExtractResponse {
  text: string;           // Extracted text content
  fileName: string;       // Original file name
  fileType: 'pdf' | 'docx' | 'txt';
  method: 'ocr' | 'direct';  // 'direct' for TXT files
}
```

## Error Handling

| Error | Cause | Solution |
|-------|-------|----------|
| "CASEDEV_API_KEY is required" | Missing API key | Add to environment |
| "PDF/DOCX extraction requires Vercel Blob" | No Blob token | Deploy to Vercel or use TXT |
| "OCR processing timed out" | Large file or slow processing | Try smaller file |
| "OCR processing failed" | Case.dev error | Check document format |

## File Size Limits

- Vercel Blob: 500MB per file (more than enough for documents)
- Case.dev OCR: Check their documentation for limits
- Recommended: Warn users for files > 50MB

## Cleanup

Files are automatically deleted:
1. After successful OCR completion
2. After OCR failure
3. After 5-minute TTL (fallback cleanup)

This prevents Blob storage accumulation.
