console.log("!!! [Indexing Service] Process Started !!!");

import path from 'node:path';
import { promises as fs } from 'node:fs';
import { connect, Table } from '@lancedb/lancedb';
import { Schema, Field, Float32, Int32, Utf8, FixedSizeList } from 'apache-arrow';
import type { CodeChunk } from './types';

// Types for transformers
type FeatureExtractionPipeline = any;
type Pipeline = any;
type Env = any;

interface VectorStore {
    table: Table;
    pipeline: FeatureExtractionPipeline;
}

// Variables
let vectorStore: VectorStore | null = null;
let transformers: { pipeline: Pipeline; env: Env; } | null = null;
let isInitializing = false;

// IPC Helper
function postToMain(message: any) {
    try {
        if (process.send) {
            process.send(message);
        } else {
            console.error("[Indexing Service] Error: process.send is not defined. Cannot communicate with main process.");
        }
    } catch (error: any) {
        console.error("[Indexing Service] Error posting message to main:", error, "Original message:", message);
        if (process.send) {
            process.send({ type: 'serviceError', payload: { message: 'Failed to serialize or send message', error: error?.message, originalMessageType: message?.type } });
        }
    }
}

// Core Logic
async function initializeVectorStore() {
    if (isInitializing) {
        console.log("[Indexing Service] Initialization already in progress...");
        return false;
    }

    if (vectorStore) {
        console.log("[Indexing Service] Vector store already initialized.");
        postToMain({ 
            type: 'initialized',
            payload: { success: true }
        });
        return true;
    }

    isInitializing = true;

    try {
        // Try configuring env *before* dynamic import (unlikely to fix, but worth a try)
        console.log("[Indexing Service] Pre-configuring transformer environment (Attempt 1)...");
        const tempTransformers = await import('@xenova/transformers'); // Import temporarily
        tempTransformers.env.allowLocalModels = true;
        const cacheDir = path.join(process.cwd(), '.cache/models');
        tempTransformers.env.cacheDir = cacheDir;
        await fs.mkdir(cacheDir, { recursive: true });
        console.log("[Indexing Service] Pre-configuration attempt complete.");

        console.log("[Indexing Service] STEP 1: Importing transformers...");
        transformers = await import('@xenova/transformers');
        console.log("[Indexing Service] STEP 1: Transformers imported.");

        console.log("[Indexing Service] STEP 2: Re-applying/Verifying transformer environment configuration...");
        transformers.env.allowLocalModels = true; // Re-apply just in case
        transformers.env.cacheDir = cacheDir; // Re-apply just in case
        console.log(`[Indexing Service] STEP 2: Transformer env configured (Cache: ${cacheDir}).`);

        console.log("[Indexing Service] STEP 3: Initializing embedding pipeline (quantized)...");
        const pipeline = await transformers.pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
            cache_dir: cacheDir,
            quantized: true // Set to true
        });
        console.log('[Indexing Service] STEP 3: Quantized pipeline initialized successfully.');

        console.log("[Indexing Service] STEP 4: Setting up LanceDB...");
        const dbDir = path.join(process.cwd(), '.lancedb');
        await fs.mkdir(dbDir, { recursive: true });
        console.log(`[Indexing Service] STEP 4: LanceDB directory ensured (${dbDir}).`);
        
        console.log("[Indexing Service] STEP 5: Connecting to LanceDB...");
        const db = await connect(dbDir);
        console.log('[Indexing Service] STEP 5: Connected to LanceDB.');

        console.log("[Indexing Service] STEP 6: Opening/Creating LanceDB table...");
        let table: Table;
        const tableName = 'code_chunks';
        const tableSchema = new Schema([
            new Field('vector', new FixedSizeList(384, new Field('item', new Float32(), true)), false),
            new Field('text', new Utf8(), true),
            new Field('file', new Utf8(), true),
            new Field('startLine', new Int32(), true),
            new Field('endLine', new Int32(), true)
        ]);

        try {
            console.log(`[Indexing Service] STEP 6a: Attempting to open table '${tableName}'`);
            table = await db.openTable(tableName);
            console.log(`[Indexing Service] STEP 6a: Opened existing table '${tableName}'.`);
        } catch (e: any) {
            const errorMessage = e.message?.toLowerCase() || ''; // Get lowercase message
            console.warn(`[Indexing Service] STEP 6b: Failed to open table. Error caught: ${e.message}`);
            // Simplified and case-insensitive check for table not found
            if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
                console.log(`[Indexing Service] STEP 6b: Table '${tableName}' not found. Creating...`);
                try {
                    table = await db.createTable(tableName, [], { schema: tableSchema });
                    console.log(`[Indexing Service] STEP 6b: Successfully created table '${tableName}'.`);
                } catch (createError: any) {
                    console.error(`[Indexing Service] STEP 6b: FATAL - Failed to create table '${tableName}' after it was not found. Error:`, createError);
                    throw createError; // Throw the creation error
                }
            } else {
                // Handle other unexpected errors during openTable
                console.error("[Indexing Service] STEP 6b: Unexpected error opening table:", e);
                throw e; // Re-throw unexpected errors
            }
        }
        console.log("[Indexing Service] STEP 6: Table ready.");

        console.log("[Indexing Service] STEP 7: Storing references and signaling success...");
        vectorStore = { table, pipeline };
        console.log('[Indexing Service] Vector store initialized successfully.');

        // Signal success to main process
        postToMain({ 
            type: 'initialized',
            payload: { success: true }
        });

        return true;

    } catch (error: any) {
        console.error('[Indexing Service] Error during initialization:', error);
        postToMain({ 
            type: 'initialized',
            payload: { 
                success: false,
                error: error?.message || 'Unknown error during initialization'
            }
        });
        // Reset state on error
        vectorStore = null;
        transformers = null;
        return false;
    } finally {
        isInitializing = false;
    }
}

async function addChunk(chunk: CodeChunk) {
    console.log(`[Indexing Service] Received request to add chunk: ${chunk?.id}`);
    
    // Check for vectorStore initialization
    if (!vectorStore) { 
        console.error("[Indexing Service] Cannot add chunk: Vector store not initialized.");
        postToMain({ 
            type: 'addChunkResult', 
            payload: { 
                success: false, 
                chunkId: chunk?.id, 
                error: 'Vector store not initialized' 
            } 
        });
        return;
    }

    try {
        console.log(`[Indexing Service] ADD_CHUNK ${chunk.id} - STEP 1: Generating embedding...`);
        const embeddingOutput = await vectorStore.pipeline(chunk.code, { 
            pooling: 'mean', 
            normalize: true 
        });
        console.log(`[Indexing Service] ADD_CHUNK ${chunk.id} - STEP 2: Embedding generated. Output type: ${typeof embeddingOutput}, data type: ${embeddingOutput?.data?.constructor?.name}`);
        
        // Ensure vector is extracted correctly
        let vector: number[];
        if (embeddingOutput?.data instanceof Float32Array) {
             vector = Array.from(embeddingOutput.data);
        } else {
             console.error(`[Indexing Service] ADD_CHUNK ${chunk.id} - ERROR: Unexpected embedding output data type:`, embeddingOutput?.data);
             throw new Error("Unexpected embedding output data type");
        }
        console.log(`[Indexing Service] ADD_CHUNK ${chunk.id} - STEP 3: Vector extracted (length: ${vector?.length}).`);

        console.log(`[Indexing Service] ADD_CHUNK ${chunk.id} - STEP 4: Adding data to LanceDB table...`);
        await vectorStore.table.add([{ // Add data as an array of objects
            vector,
            text: chunk.code,
            file: chunk.file_path,
            startLine: chunk.startLine,
            endLine: chunk.endLine
        }]);
        console.log(`[Indexing Service] ADD_CHUNK ${chunk.id} - STEP 5: Successfully added to table.`);

        // Signal success for this chunk
        postToMain({ 
            type: 'addChunkResult', 
            payload: { 
                success: true, 
                chunkId: chunk.id 
            } 
        });
    } catch (error: any) {
        console.error(`[Indexing Service] ADD_CHUNK ${chunk?.id} - ERROR during processing:`, error);
        // Ensure full error details are logged
        console.error(`[Indexing Service] ADD_CHUNK ${chunk?.id} - Error Name: ${error.name}, Message: ${error.message}, Stack: ${error.stack}`); 
        postToMain({ 
            type: 'addChunkResult', 
            payload: { 
                success: false, 
                chunkId: chunk?.id, 
                error: error.message 
            } 
        });
    }
}

async function getStatus() {
    console.log("[Indexing Service] Received request for status.");
    if (!vectorStore) {
        postToMain({ 
            type: 'statusResult', 
            payload: { 
                itemCount: 0, 
                status: 'uninitialized', 
                error: 'Vector store not initialized' 
            } 
        });
        return;
    }
    try {
        const count = await vectorStore.table.countRows();
        console.log(`[Indexing Service] Current item count: ${count}`);
        postToMain({ 
            type: 'statusResult', 
            payload: { 
                itemCount: count, 
                status: 'initialized' 
            } 
        });
    } catch (error: any) {
        console.error(`[Indexing Service] Error getting count:`, error);
        postToMain({ 
            type: 'statusResult', 
            payload: { 
                itemCount: 0, 
                status: 'error', 
                error: error.message 
            } 
        });
    }
}

// Initialize immediately and set up message handler when ready
(async () => {
    try {
        console.log("[Indexing Service] Starting service...");
        
        if (!process.send) {
            throw new Error("[Indexing Service] CRITICAL: process.send is not defined. Service cannot operate.");
        }

        // Set up message handler first
        console.log("[Indexing Service] Setting up message handler...");
        process.on('message', async (message: any) => {
            console.log("[Indexing Service] Received message:", message?.type);
            try {
                switch (message?.type) {
                    case 'initialize':
                        if (isInitializing) {
                            console.log("[Indexing Service] Initialization already in progress...");
                            return;
                        }
                        await initializeVectorStore();
                        break;
                    case 'addChunk':
                        if (isInitializing) {
                            console.log("[Indexing Service] Cannot add chunk while initializing. Please wait...");
                            postToMain({ 
                                type: 'addChunkResult', 
                                payload: { 
                                    success: false, 
                                    chunkId: message.payload?.id, 
                                    error: 'Service is still initializing' 
                                } 
                            });
                            return;
                        }
                        if (message.payload) {
                            await addChunk(message.payload as CodeChunk);
                        } else {
                            throw new Error("'addChunk' message received without payload.");
                        }
                        break;
                    case 'getStatus':
                        await getStatus();
                        break;
                    default:
                        console.warn("[Indexing Service] Received unknown message type:", message?.type);
                }
            } catch (error: any) {
                console.error("[Indexing Service] Error processing message:", error);
                postToMain({ 
                    type: 'serviceError', 
                    payload: { 
                        message: error?.message || 'Unknown error processing message',
                        messageType: message?.type
                    } 
                });
            }
        });

        // Signal that we're ready to receive messages
        console.log("[Indexing Service] Message handler set up. Signaling ready...");
        postToMain({ type: 'ready' });

        // Attempt initial initialization
        console.log("[Indexing Service] Attempting initial initialization...");
        const success = await initializeVectorStore();
        if (!success) {
            console.error("[Indexing Service] Initial initialization failed - will retry on demand.");
            // Don't exit - just continue running and wait for explicit initialize command
        }

    } catch (error: any) {
        console.error("[Indexing Service] Critical error during service startup:", error);
        process.exit(1);
    }
})();

// Signal Handlers
process.on('SIGTERM', () => {
    console.log('[Indexing Service] Received SIGTERM. Shutting down.');
    process.exit(0);
});
process.on('SIGINT', () => {
    console.log('[Indexing Service] Received SIGINT. Shutting down.');
    process.exit(0);
});

// Exception Handlers
process.on('uncaughtException', (error, origin) => {
  console.error(`[Indexing Service] Uncaught Exception at: ${origin}, error:`, error);
  postToMain({ type: 'serviceError', payload: { message: `Uncaught exception: ${error?.message}`, origin: origin } });
  process.exit(1);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('[Indexing Service] Unhandled Rejection at:', promise, 'reason:', reason);
  postToMain({ type: 'serviceError', payload: { message: `Unhandled promise rejection: ${reason}` } });
}); 