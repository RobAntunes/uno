import Parser from 'tree-sitter';

export interface AnalysisResult {
    type: string;
    severity: 'info' | 'warning' | 'error';
    message: string;
    location?: {
        start: { row: number; column: number };
        end: { row: number; column: number };
    };
    context?: Record<string, any>;
}

export interface CodeAnalyzer {
    analyze(tree: Parser.Tree): Promise<AnalysisResult[]>;
    name: string;
    description: string;
} 