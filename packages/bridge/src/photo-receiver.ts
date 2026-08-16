import { createServer, IncomingMessage, ServerResponse, Server } from 'node:http';
import { writeFileSync, unlinkSync, existsSync } from 'node:fs';

export interface ReceiverOptions {
  port: number;
  timeoutMs: number;
  savePath: string;
  maxSizeBytes: number;
}

export interface ReceiverResult {
  success: boolean;
  filePath?: string;
  error?: string;
}

/**
 * Temporary single-use HTTP server that accepts a photo or video upload from iPhone Shortcut.
 * Opens on a dedicated port, accepts one valid media POST, saves to disk, and closes.
 * Auto-closes after timeout if no media arrives.
 */
export class PhotoReceiver {
  private server: Server | null = null;
  private listening = false;
  private timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  isListening(): boolean {
    return this.listening;
  }

  stop(): void {
    this.cleanup();
  }

  /**
   * Start listening for an incoming photo upload.
   * Resolves when a valid photo is received or timeout occurs.
   */
  start(options: ReceiverOptions): Promise<ReceiverResult> {
    if (this.listening) {
      return Promise.resolve({ success: false, error: 'Already listening' });
    }

    this.listening = true;

    return new Promise((resolve) => {
      let resolved = false;

      const done = (result: ReceiverResult) => {
        if (resolved) return;
        resolved = true;
        this.cleanup();
        resolve(result);
      };

      this.server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
        // Only accept POST /receive-photo
        if (req.method !== 'POST' || !req.url?.startsWith('/receive-photo')) {
          res.writeHead(404, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Not found' }));
          return;
        }

        const contentType = req.headers['content-type'] || '';

        // Validate content type: multipart/form-data, image/*, or video/*
        const isMultipart = contentType.includes('multipart/form-data');
        const isRawImage = contentType.startsWith('image/');
        const isRawVideo = contentType.startsWith('video/');

        if (!isMultipart && !isRawImage && !isRawVideo) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Expected multipart/form-data, image/*, or video/* content-type' }));
          return;
        }

        // Read body with size limit
        const chunks: Buffer[] = [];
        let totalSize = 0;

        try {
          for await (const chunk of req) {
            totalSize += (chunk as Buffer).length;
            if (totalSize > options.maxSizeBytes) {
              res.writeHead(413, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'File too large', maxBytes: options.maxSizeBytes }));
              return;
            }
            chunks.push(chunk as Buffer);
          }
        } catch {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Upload failed' }));
          return;
        }

        const body = Buffer.concat(chunks);

        // Extract media data
        let mediaBuffer: Buffer;
        if (isMultipart) {
          const extracted = extractMediaFromMultipart(body, contentType);
          if (!extracted) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'No media found in multipart body' }));
            return;
          }
          mediaBuffer = extracted.buffer;
          // Use detected type from multipart headers if available
          const detectedVideo = extracted.isVideo || isRawVideo;
          const ext = detectedVideo ? detectVideoExtension(mediaBuffer, contentType) : detectImageExtension(mediaBuffer);
          const finalPath = `${options.savePath}${ext}`;

          try {
            writeFileSync(finalPath, mediaBuffer);
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Failed to save: ${err.message}` }));
            return;
          }

          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, size: mediaBuffer.length, type: detectedVideo ? 'video' : 'image' }));

          console.log(`📱 Media received: ${mediaBuffer.length} bytes (${detectedVideo ? 'video' : 'image'}) from ${req.socket.remoteAddress}`);
          done({ success: true, filePath: finalPath });
        } else {
          mediaBuffer = body;

          if (isRawVideo) {
            // Video: save with appropriate extension
            const ext = detectVideoExtension(mediaBuffer, contentType);
            const finalPath = `${options.savePath}${ext}`;
            try {
              writeFileSync(finalPath, mediaBuffer);
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Failed to save: ${err.message}` }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, size: mediaBuffer.length, type: 'video' }));
            console.log(`📱 Video received: ${mediaBuffer.length} bytes from ${req.socket.remoteAddress}`);
            done({ success: true, filePath: finalPath });
          } else {
            // Image: validate magic bytes
            if (!isValidImage(mediaBuffer)) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'Invalid image data' }));
              return;
            }
            const ext = detectImageExtension(mediaBuffer);
            const finalPath = `${options.savePath}${ext}`;
            try {
              writeFileSync(finalPath, mediaBuffer);
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: `Failed to save: ${err.message}` }));
              return;
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true, size: mediaBuffer.length, type: 'image' }));
            console.log(`📱 Photo received: ${mediaBuffer.length} bytes from ${req.socket.remoteAddress}`);
            done({ success: true, filePath: finalPath });
          }
        }
      });

      // Timeout
      this.timeoutHandle = setTimeout(() => {
        console.log('📱 Photo receiver timed out');
        done({ success: false, error: 'Timeout: no photo received within 60s' });
      }, options.timeoutMs);

      // Start listening
      this.server.on('error', (err: Error) => {
        console.error(`📱 Photo receiver server error: ${err.message}`);
        done({ success: false, error: `Server error: ${err.message}` });
      });

      this.server.listen(options.port, '0.0.0.0', () => {
        console.log(`📱 Photo receiver listening on port ${options.port}`);
      });
    });
  }

  private cleanup(): void {
    this.listening = false;

    if (this.timeoutHandle) {
      clearTimeout(this.timeoutHandle);
      this.timeoutHandle = null;
    }

    if (this.server) {
      try {
        this.server.close();
      } catch {
        // Already closed
      }
      this.server = null;
    }
  }
}

/**
 * Extract media data from a multipart/form-data body.
 * Simple parser that finds the first binary part after the headers.
 */
function extractMediaFromMultipart(body: Buffer, contentType: string): { buffer: Buffer; isVideo: boolean } | null {
  // Extract boundary from content-type
  const boundaryMatch = contentType.match(/boundary=(.+?)(?:;|$)/);
  if (!boundaryMatch) return null;

  const boundary = boundaryMatch[1]!.trim();

  // Find the start of file data (after double CRLF in the first part)
  const bodyStr = body.toString('binary');
  const parts = bodyStr.split(`--${boundary}`);

  for (const part of parts) {
    if (part === '--' || part === '--\r\n' || part.trim() === '') continue;

    // Find end of headers (double CRLF)
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headers = part.substring(0, headerEnd).toLowerCase();

    // Check if this part contains media
    const isVideo = headers.includes('video/') || headers.includes('.mov') || headers.includes('.mp4');
    const isImage = headers.includes('image/');
    const hasFilename = headers.includes('filename=');

    if (isVideo || isImage || hasFilename) {
      const dataStart = headerEnd + 4; // skip \r\n\r\n
      let data = part.substring(dataStart);

      // Remove trailing \r\n before next boundary
      if (data.endsWith('\r\n')) {
        data = data.substring(0, data.length - 2);
      }

      return { buffer: Buffer.from(data, 'binary'), isVideo };
    }
  }

  return null;
}

/**
 * Detect video file extension from content-type or magic bytes.
 */
function detectVideoExtension(buffer: Buffer, contentType: string): string {
  if (contentType.includes('quicktime') || contentType.includes('mov')) return '.mov';
  if (contentType.includes('mp4')) return '.mp4';
  // Check for MP4/MOV magic bytes (ftyp at offset 4)
  if (buffer.length >= 8 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return '.mp4';
  }
  return '.mov'; // default for iPhone video
}

/**
 * Detect image file extension from magic bytes.
 */
function detectImageExtension(buffer: Buffer): string {
  if (buffer[0] === 0xFF && buffer[1] === 0xD8) return '.jpg';
  if (buffer[0] === 0x89 && buffer[1] === 0x50) return '.png';
  // HEIC
  if (buffer.length >= 12 && buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return '.heic';
  }
  return '.jpg'; // default
}

/**
 * Check magic bytes to verify the buffer contains valid image data.
 * Supports JPEG, PNG, and HEIC/HEIF.
 */
function isValidImage(buffer: Buffer): boolean {
  if (buffer.length < 8) return false;

  // JPEG: starts with FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return true;
  }

  // PNG: starts with 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return true;
  }

  // HEIC/HEIF: has 'ftyp' at offset 4
  if (buffer.length >= 12 &&
      buffer[4] === 0x66 && buffer[5] === 0x74 && buffer[6] === 0x79 && buffer[7] === 0x70) {
    return true;
  }

  return false;
}
