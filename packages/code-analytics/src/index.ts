import { CodeParser } from './parser/parser';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './analyzers/types';
import { DeadCodeAnalyzer } from './analyzers/deadCode';
import { NamingConventionAnalyzer } from './analyzers/namingConvention';
import { FunctionLengthAnalyzer } from './analyzers/functionLength';
import { CyclomaticComplexityAnalyzer } from './analyzers/cyclomaticComplexity';
import { DependencyVulnerabilityAnalyzer } from './analyzers/dependencyVulnerability';
import { findProjectRoot } from './utils';
import fs from 'fs/promises';
import Parser from 'tree-sitter';
import TsParser from 'tree-sitter-typescript';
const { typescript: TypeScript } = TsParser;

export * from './analyzers/types';
export { CodeParser } from './parser/parser';
export { DeadCodeAnalyzer } from './analyzers/deadCode';
export { NamingConventionAnalyzer } from './analyzers/namingConvention';
export { FunctionLengthAnalyzer } from './analyzers/functionLength';
export { CyclomaticComplexityAnalyzer } from './analyzers/cyclomaticComplexity';
export { DependencyVulnerabilityAnalyzer } from './analyzers/dependencyVulnerability';

export class CodeAnalytics {
    private parser: CodeParser;
    private analyzers: CodeAnalyzer[];

    constructor() {
        this.parser = new CodeParser();
        this.analyzers = [
            new DeadCodeAnalyzer(),
            new NamingConventionAnalyzer(),
            new FunctionLengthAnalyzer(),
            new CyclomaticComplexityAnalyzer(),
            new DependencyVulnerabilityAnalyzer()
        ];
    }

    public getAnalyzers(): CodeAnalyzer[] {
        return this.analyzers;
    }

    /**
     * Analyze source code using all registered analyzers
     * @param sourceCode The source code to analyze
     * @param filePath Optional path for context (used by some analyzers)
     * @param projectRoot Optional path to the root of the project being analyzed
     * @returns Array of analysis results
     */
    async analyzeCode(sourceCode: string, filePath?: string, projectRoot?: string): Promise<AnalysisResult[]> {
        const tree = this.parser.parse(sourceCode);
        const allResults: AnalysisResult[] = [];

        for (const analyzer of this.analyzers) {
            try {
                const analyzerResults = await analyzer.analyze(tree, { filePath, projectRoot });
                allResults.push(...analyzerResults);
            } catch (error) {
                console.error(`Error running analyzer '${analyzer.name}':`, error);
                allResults.push({
                    analyzer: 'CodeAnalytics Core',
                    line: 0,
                    type: 'error',
                    message: `Analyzer '${analyzer.name}' failed: ${error instanceof Error ? error.message : String(error)}`,
                    diagnostic: { rawError: String(error) }
                });
            }
        }

        return allResults;
    }

    /**
     * Analyze a source file using all registered analyzers
     * @param filePath Path to the source file
     * @param projectRoot Optional path to the root of the project containing the file
     * @returns Array of analysis results
     */
    async analyzeFile(filePath: string, projectRoot?: string): Promise<AnalysisResult[]> {
        const effectiveProjectRoot = projectRoot ?? await findProjectRoot(filePath) ?? process.cwd();

        const parser = new Parser();
        parser.setLanguage(TypeScript);

        const sourceCode = await fs.readFile(filePath, 'utf-8');
        const tree = parser.parse(sourceCode);
        const allResults: AnalysisResult[] = [];

        for (const analyzer of this.analyzers) {
            try {
                const analyzerResults = await analyzer.analyze(tree, { filePath, projectRoot: effectiveProjectRoot });
                allResults.push(...analyzerResults);
            } catch (error) {
                console.error(`Error running analyzer '${analyzer.name}' on file '${filePath}':`, error);
                allResults.push({
                    analyzer: 'CodeAnalytics Core',
                    line: 0,
                    type: 'error',
                    message: `Analyzer '${analyzer.name}' failed on file '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
                    diagnostic: { file: filePath, rawError: String(error) }
                });
            }
        }

        return allResults;
    }
} 