// apps/uno-electron/src/services/indexing/types.ts

// Define the CodeChunk interface (adjust properties as needed)
export interface CodeChunk {
  id: string;
  file_path: string;
  language: string;
  code: string;
  startLine: number;
  endLine: number;
  // Add other relevant fields like start_line, end_line etc.
} 