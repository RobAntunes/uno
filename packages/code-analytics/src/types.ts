import Parser from 'tree-sitter';

/**
 * Represents the result of a single analysis check.
 */
export interface AnalysisResult {
    type: 'error' | 'warning' | 'info';
    // severity: 'error' | 'warning' | 'info'; // Let's consolidate on 'type'
    message: string;
    analyzer: string; // Ensure this property exists
    line: number;     // Ensure this property exists
    diagnostic?: Record<string, any>; // Diagnostic for structured data
}

export interface AnalysisContext {
    filePath?: string;
    projectRoot?: string;
    sourceCode?: string;
    tree?: Parser.Tree;
}

export interface CodeAnalyzer {
    name: string;
    description: string;
    analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]>;
} 