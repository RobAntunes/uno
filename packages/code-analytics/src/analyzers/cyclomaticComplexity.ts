import Parser, { SyntaxNode, TreeCursor } from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';

const CYCLOMATIC_COMPLEXITY_THRESHOLD = 10; // Common threshold

export class CyclomaticComplexityAnalyzer implements CodeAnalyzer {
    name = 'cyclomatic-complexity';
    description = `Calculates Cyclomatic Complexity and flags functions exceeding a threshold (${CYCLOMATIC_COMPLEXITY_THRESHOLD}).`;

    async analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        this.analyzeNode(tree.walk(), results);
        return results;
    }

    private analyzeNode(cursor: TreeCursor, results: AnalysisResult[]) {
        do {
            const node = cursor.currentNode;
            let functionName = '<anonymous>';
            let isFunctionLike = false;

            // Identify function-like nodes
            if (node.type === 'function_declaration' || 
                node.type === 'method_definition' || 
                node.type === 'arrow_function') 
            {
                 isFunctionLike = true;
                 // Attempt to find a name identifier
                 if (cursor.gotoFirstChild()) {
                    do {
                        if (cursor.currentFieldName === 'name' && cursor.nodeType === 'identifier') {
                            functionName = cursor.currentNode.text;
                            break;
                        }
                        if (node.type === 'arrow_function' && node.parent?.type === 'variable_declarator') {
                             const varNameNode = node.parent.firstNamedChild;
                             if (varNameNode?.type === 'identifier') {
                                 functionName = varNameNode.text;
                             }
                         }
                    } while (cursor.gotoNextSibling());
                    cursor.gotoParent();
                 }

                 // Calculate complexity for this function
                 const complexity = this.calculateCyclomaticComplexity(node);
                 
                 if (complexity > CYCLOMATIC_COMPLEXITY_THRESHOLD) {
                      results.push({
                        analyzer: this.name,
                        line: node.startPosition.row,
                        type: 'warning',
                        message: `Function '${functionName}' has a cyclomatic complexity of ${complexity}, which exceeds the threshold of ${CYCLOMATIC_COMPLEXITY_THRESHOLD}.`,
                        diagnostic: {
                            functionName: functionName,
                            complexity: complexity,
                            threshold: CYCLOMATIC_COMPLEXITY_THRESHOLD
                        }
                    });
                 }
            }

            // --- Traversal --- 
            // Recurse into children, but NOT into nested function bodies 
            // (calculateCyclomaticComplexity handles function bodies separately)
            if (!isFunctionLike && cursor.gotoFirstChild()) {
                this.analyzeNode(cursor, results);
                cursor.gotoParent();
            }
        } while (cursor.gotoNextSibling());
    }

    private calculateCyclomaticComplexity(functionNode: SyntaxNode): number {
        let complexity = 1; // Start complexity at 1 for the function itself
        const cursor = functionNode.walk();

        const traverse = () => {
             do {
                 const nodeType = cursor.nodeType;
                 
                 // Increment for decision points
                 switch (nodeType) {
                    case 'if_statement':
                    case 'while_statement':
                    case 'do_statement':
                    case 'for_statement':
                    case 'for_in_statement': 
                    case 'catch_clause':
                    case 'conditional_expression': // ternary operator (? :)
                    case 'case_statement': // case in switch
                         complexity++;
                         break;
                     case 'binary_expression':
                         // Check for logical AND (&&) and OR (||)
                         // Nullish coalescing (??) also adds a branch
                         const operatorNode = cursor.currentNode.child(1); // Operator is usually the middle child
                         if (operatorNode && ['&&', '||', '??'].includes(operatorNode.type)) {
                              complexity++;
                         }
                         break;
                 }

                 // Recurse into children, but skip nested function definitions 
                 // as their complexity is calculated separately when the outer loop encounters them.
                 if (!['function_declaration', 'method_definition', 'arrow_function', 'class_declaration'].includes(nodeType) && cursor.gotoFirstChild()) {
                     traverse();
                     cursor.gotoParent();
                 }
            } while (cursor.gotoNextSibling());
        }
        
        // Start traversal from the children of the main function node
        if (cursor.gotoFirstChild()) {
             traverse();
             cursor.gotoParent(); // Should end back on functionNode
        } 

        return complexity;
    }
} 