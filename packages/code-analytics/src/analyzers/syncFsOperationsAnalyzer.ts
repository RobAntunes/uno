import Parser, { SyntaxNode } from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';

// List of common synchronous fs methods to flag
const SYNC_FS_METHODS = new Set([
    'readFileSync',
    'writeFileSync',
    'appendFileSync',
    'statSync',
    'lstatSync',
    'existsSync', // Note: existsSync is often debated, but can still block
    'accessSync',
    'readdirSync',
    'mkdirSync',
    'mkdtempSync',
    'rmdirSync',
    'rmSync',
    'unlinkSync',
    'copyFileSync',
    'chownSync',
    'chmodSync',
    'linkSync',
    'symlinkSync',
    'readlinkSync',
    'realpathSync',
    'renameSync',
    'truncateSync',
    'utimesSync'
]);

export class SyncFsOperationsAnalyzer implements CodeAnalyzer {
    name = 'sync-fs-operations';
    description = 'Detects the use of synchronous file system operations which can block the event loop.';

    async analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        const rootNode = tree.rootNode;

        // --- Track 'fs' imports --- 
        const fsNamespaceImports = new Set<string>(); // For `import * as fsAlias from 'fs'`
        const fsNamedImports = new Map<string, string>(); // For `import { readFileSync as rfs } from 'fs'`, maps alias (rfs) to original name (readFileSync)

        rootNode.children.forEach(node => {
            if (node.type === 'import_statement') {
                const sourceNode = node.children.find(c => c.type === 'string');
                const source = sourceNode?.text.slice(1, -1); // Remove quotes

                if (source === 'fs' || source === 'node:fs') {
                    const importClause = node.children.find(c => c.type === 'import_clause');
                    if (importClause) {
                        // Check for namespace import: `import * as fsAlias from 'fs'`
                        const namespaceImport = importClause.children.find(c => c.type === 'namespace_import');
                        if (namespaceImport) {
                            const aliasNode = namespaceImport.children.find(c => c.type === 'identifier');
                            if (aliasNode) {
                                fsNamespaceImports.add(aliasNode.text);
                            }
                        }

                        // Check for named imports: `import { method, other as alias } from 'fs'`
                        const namedImportsNode = importClause.children.find(c => c.type === 'named_imports');
                        if (namedImportsNode) {
                            namedImportsNode.children.forEach(importSpecifier => {
                                if (importSpecifier.type === 'import_specifier') {
                                    const nameNode = importSpecifier.children.find(c => c.type === 'identifier' || c.type === 'property_identifier');
                                    const aliasNode = importSpecifier.children.find(c => c.type === 'identifier' && c !== nameNode); 
                                    
                                    const originalName = nameNode?.text ?? '';
                                    const alias = aliasNode?.text ?? originalName; 

                                    if (originalName && SYNC_FS_METHODS.has(originalName)) {
                                        fsNamedImports.set(alias, originalName);
                                    }
                                }
                            });
                        }
                    }
                }
            }
        });
        // Add default 'fs' if no specific namespace import is found, assuming `import fs from 'fs'` or require
        if (fsNamespaceImports.size === 0 && !rootNode.text.includes('import * as')) {
             fsNamespaceImports.add('fs'); 
        }
        // --- End Track 'fs' imports ---

        const checkNode = (node: SyntaxNode) => {
            if (node.type === 'call_expression') {
                const functionNode = node.namedChildren.find(child => child.type === 'member_expression' || child.type === 'identifier');

                // 1. Check for calls like fsAlias.readFileSync() or fs.readFileSync()
                if (functionNode?.type === 'member_expression') {
                    const objectNode = functionNode.namedChildren.find(child => child.type === 'identifier');
                    const propertyNode = functionNode.namedChildren.find(child => child.type === 'property_identifier');
                    const objectName = objectNode?.text;
                    const methodName = propertyNode?.text;

                    // Check if the object name is one of the tracked fs namespaces
                    if (objectName && fsNamespaceImports.has(objectName) && methodName && SYNC_FS_METHODS.has(methodName)) {
                        results.push({
                            analyzer: this.name,
                            line: node.startPosition.row + 1,
                            type: 'warning',
                            message: `Avoid using synchronous file system operation '${objectName}.${methodName}'. Use the asynchronous version instead.`,
                            diagnostic: { functionName: methodName }
                        });
                    }
                } 
                // 2. Check for direct calls like readFileSync() or rfs()
                else if (functionNode?.type === 'identifier') {
                    const functionName = functionNode.text;
                    // Check if the function name is an alias for a synchronous fs method
                    if (fsNamedImports.has(functionName)) {
                        const originalName = fsNamedImports.get(functionName);
                         results.push({
                            analyzer: this.name,
                            line: node.startPosition.row + 1,
                            type: 'warning',
                            message: `Avoid using synchronous file system operation '${functionName}' (imported from 'fs'). Use the asynchronous version ('${originalName}') instead.`,
                            diagnostic: { functionName: functionName, originalName: originalName }
                        });
                    }
                }
            }

            // Recurse
            for (const child of node.namedChildren) {
                checkNode(child);
            }
        };

        checkNode(rootNode);

        return results;
    }
} 