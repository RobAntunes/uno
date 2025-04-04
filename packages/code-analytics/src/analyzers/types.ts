import Parser from 'tree-sitter';

export interface AnalysisResult {
    type: 'error' | 'warning' | 'info';
    message: string;
    analyzer: string;
    line: number;
    diagnostic?: any;
}

export interface AnalysisContext {
    filePath?: string;
    projectRoot?: string;
}

export interface CodeAnalyzer {
    analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]>;
    name: string;
    description: string;
} 