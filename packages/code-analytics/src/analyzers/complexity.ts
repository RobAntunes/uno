import Parser from 'tree-sitter';
import { CodeAnalyzer, AnalysisResult } from './types';

export class ComplexityAnalyzer implements CodeAnalyzer {
    name = 'complexity';
    description = 'Analyzes code complexity based on nesting and statements';

    async analyze(tree: Parser.Tree): Promise<AnalysisResult[]> {
        const results: AnalysisResult[] = [];
        this.analyzeFunctions(tree.rootNode, results);
        return results;
    }

    private analyzeFunctions(node: Parser.SyntaxNode, results: AnalysisResult[]) {
        if (node.type === 'function_declaration' || node.type === 'method_definition') {
            const complexity = this.calculateComplexity(node);
            
            if (complexity > 5) {
                results.push({
                    type: 'complexity',
                    severity: complexity > 10 ? 'error' : 'warning',
                    message: `Function has high complexity score of ${complexity}`,
                    location: {
                        start: { row: node.startPosition.row, column: node.startPosition.column },
                        end: { row: node.endPosition.row, column: node.endPosition.column }
                    },
                    context: { complexity }
                });
            }
        }

        // Recursively analyze child nodes
        for (const child of node.children) {
            this.analyzeFunctions(child, results);
        }
    }

    private calculateComplexity(node: Parser.SyntaxNode): number {
        let complexity = 1; // Base complexity

        const addComplexity = (n: Parser.SyntaxNode) => {
            // Add complexity for control flow statements
            switch (n.type) {
                case 'if_statement':
                case 'for_statement':
                case 'while_statement':
                case 'do_statement':
                case 'catch_clause':
                case 'case_statement':
                    complexity++;
                    break;
                case 'binary_expression':
                    if (n.text.includes('&&') || n.text.includes('||')) {
                        complexity++;
                    }
                    break;
            }

            // Recursively analyze child nodes
            for (const child of n.children) {
                addComplexity(child);
            }
        };

        addComplexity(node);
        return complexity;
    }
} 