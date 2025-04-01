// apps/uno-electron/src/services/indexing/chunker.ts
import * as path from 'node:path';
import { v4 as uuidv4 } from 'uuid';
import type { CodeChunk } from './types';

// Basic configuration (can be expanded)
const DEFAULT_CHUNK_SIZE = 1000; // Characters per chunk (adjust as needed)
const DEFAULT_CHUNK_OVERLAP = 100; // Overlap between chunks

interface ChunkOptions {
    chunkSize?: number;
    chunkOverlap?: number;
}

// Helper to calculate line number (1-based) from character index
// Handles \n, \r\n, and \r line endings
function calculateLineNumber(code: string, charIndex: number): number {
    if (charIndex < 0) return 1;
    let lineNumber = 1;
    for (let i = 0; i < charIndex && i < code.length; ++i) {
        if (code[i] === '\n') {
            lineNumber++;
        } else if (code[i] === '\r') {
            // Only count \r if it's not followed by \n (part of \r\n)
            if (!(i + 1 < code.length && code[i+1] === '\n')) {
                lineNumber++;
            }
        }
    }
    return lineNumber;
}

/**
 * Simple code chunker based on character count with overlap.
 * Includes start/end line numbers for each chunk.
 */
export function chunkCode(
    filePath: string,
    code: string,
    options: ChunkOptions = {},
): CodeChunk[] {
    const {
        chunkSize = DEFAULT_CHUNK_SIZE,
        chunkOverlap = DEFAULT_CHUNK_OVERLAP,
    } = options;

    if (chunkOverlap >= chunkSize) {
        throw new Error('Chunk overlap must be smaller than chunk size.');
    }

    const chunks: CodeChunk[] = [];
    const language = path.extname(filePath).substring(1) || 'unknown';
    let startIndex = 0;

    while (startIndex < code.length) {
        const endIndex = Math.min(startIndex + chunkSize, code.length);
        const chunkText = code.substring(startIndex, endIndex);

        // Calculate start and end lines for the chunk
        const startLine = calculateLineNumber(code, startIndex);
        // Get line number for the last character in the chunk (or startIndex if chunk is empty/invalid)
        const endCharIndex = Math.max(startIndex, endIndex - 1);
        const endLine = calculateLineNumber(code, endCharIndex);

        chunks.push({
            id: uuidv4(),
            file_path: filePath,
            language: language,
            code: chunkText,
            startLine: startLine,
            endLine: endLine,
        });

        // Move to the start of the next potential chunk
        startIndex += chunkSize - chunkOverlap;

        // Basic check to prevent infinite loops if logic is flawed or overlap is too large
        if (startIndex >= code.length) {
            break;
        }
         // Ensure progress if overlap makes startIndex regress or stay the same
         if (startIndex <= (endIndex - chunkSize + chunkOverlap)) {
             // If no progress was made due to overlap, force moving past the current chunk end
             // This prevents getting stuck on very small files or large overlaps
              if (endIndex < code.length) {
                   startIndex = endIndex; // Jump to the end of the current chunk
              } else {
                   break; // Already processed the end of the code
              }
         }
    }

    // Handle case where code is shorter than chunk size and the loop didn't run
    if (chunks.length === 0 && code.length > 0) {
        const startLine = 1;
        const endLine = calculateLineNumber(code, code.length - 1);
        chunks.push({
            id: uuidv4(),
            file_path: filePath,
            language: language,
            code: code,
            startLine: startLine,
            endLine: endLine,
        });
    }

    return chunks;
} 