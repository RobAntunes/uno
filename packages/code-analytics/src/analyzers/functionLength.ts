import Parser, { SyntaxNode, TreeCursor } from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult } from './types';

const MAX_FUNCTION_LINES = 50; // Configurable threshold

export class FunctionLengthAnalyzer implements CodeAnalyzer {
    name = 'function-length';
    description = `Checks for functions/methods exceeding ${MAX_FUNCTION_LINES} lines.`;

    async analyze(tree: Parser.Tree): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        this.findLongFunctions(tree.walk(), results);
        return results;
    }

    private findLongFunctions(cursor: TreeCursor, results: AnalysisResult[]) {
        do {
            const node = cursor.currentNode;
            let functionBodyNode: SyntaxNode | null = null;
            let functionName = '<anonymous>';
            
            // Identify function-like nodes that have a body
            if (node.type === 'function_declaration' || 
                node.type === 'method_definition' || 
                node.type === 'arrow_function') 
            {
                // Attempt to find a name identifier
                 if (cursor.gotoFirstChild()) {
                    do {
                        if (cursor.currentFieldName === 'name' && cursor.nodeType === 'identifier') {
                            functionName = cursor.currentNode.text;
                            break;
                        }
                         // For arrow functions assigned to variables
                         if (node.type === 'arrow_function' && node.parent?.type === 'variable_declarator') {
                             const varNameNode = node.parent.firstNamedChild;
                             if (varNameNode?.type === 'identifier') {
                                 functionName = varNameNode.text;
                             }
                         }
                    } while (cursor.gotoNextSibling());
                    cursor.gotoParent();
                 }

                // Find the body node using cursor properties within namedChildren iteration
                 let foundBody = false;
                 if (cursor.gotoFirstChild()) {
                     do {
                         if (cursor.currentFieldName === 'body') {
                            functionBodyNode = cursor.currentNode;
                            foundBody = true;
                            break;
                         }
                         // Also check for statement_block if body field isn't present
                         if (cursor.currentNode.type === 'statement_block') {
                              functionBodyNode = cursor.currentNode; 
                              // Don't break here, body field might still appear for arrow funcs
                         }
                     } while(cursor.gotoNextSibling());
                     cursor.gotoParent();
                 }
                 // If we didn't find a body via field name, use the statement_block if found
                 // (This handles cases where statement_block isn't explicitly named 'body')
                 // Note: This relies on statement_block being found during the child iteration above.
            }

            if (functionBodyNode) {
                const startLine = functionBodyNode.startPosition.row;
                const endLine = functionBodyNode.endPosition.row;
                const lineCount = endLine - startLine + 1;

                if (lineCount > MAX_FUNCTION_LINES) {
                    results.push({
                        type: 'function-length',
                        severity: 'warning',
                        message: `Function/Method '${functionName}' is too long (${lineCount} lines, max ${MAX_FUNCTION_LINES}). Consider refactoring.`,
                        location: {
                            start: { row: node.startPosition.row, column: node.startPosition.column }, // Report at function start
                            end: { row: node.startPosition.row, column: node.startPosition.column + functionName.length } // Approx end of name
                        },
                        context: { lineCount, functionName }
                    });
                }
            }

            // --- Traversal --- 
            if (cursor.gotoFirstChild()) {
                this.findLongFunctions(cursor, results);
                cursor.gotoParent();
            }
        } while (cursor.gotoNextSibling());
    }
} 