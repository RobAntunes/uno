import { CodeParser } from './parser/parser';
import { CodeAnalyzer, AnalysisResult } from './analyzers/types';
import { ComplexityAnalyzer } from './analyzers/complexity';
import { DeadCodeAnalyzer } from './analyzers/deadCode';
import { NamingConventionAnalyzer } from './analyzers/namingConvention';
import { FunctionLengthAnalyzer } from './analyzers/functionLength';

export * from './analyzers/types';
export { CodeParser } from './parser/parser';
export { ComplexityAnalyzer } from './analyzers/complexity';
export { DeadCodeAnalyzer } from './analyzers/deadCode';
export { NamingConventionAnalyzer } from './analyzers/namingConvention';
export { FunctionLengthAnalyzer } from './analyzers/functionLength';

export class CodeAnalytics {
    private parser: CodeParser;
    private analyzers: CodeAnalyzer[];

    constructor() {
        this.parser = new CodeParser();
        this.analyzers = [
            new ComplexityAnalyzer(),
            new DeadCodeAnalyzer(),
            new NamingConventionAnalyzer(),
            new FunctionLengthAnalyzer()
        ];
    }

    /**
     * Analyze source code using all registered analyzers
     * @param sourceCode The source code to analyze
     * @returns Array of analysis results
     */
    async analyzeCode(sourceCode: string): Promise<AnalysisResult[]> {
        const tree = this.parser.parse(sourceCode);
        const allResults: AnalysisResult[] = [];

        for (const analyzer of this.analyzers) {
            try {
                const analyzerResults = await analyzer.analyze(tree);
                allResults.push(...analyzerResults);
            } catch (error) {
                console.error(`Error running analyzer '${analyzer.name}':`, error);
                allResults.push({
                    type: 'analyzer-error',
                    severity: 'error',
                    message: `Analyzer '${analyzer.name}' failed: ${error instanceof Error ? error.message : String(error)}`
                });
            }
        }

        return allResults;
    }

    /**
     * Analyze a source file using all registered analyzers
     * @param filePath Path to the source file
     * @returns Array of analysis results
     */
    async analyzeFile(filePath: string): Promise<AnalysisResult[]> {
        const tree = await this.parser.parseFile(filePath);
        const allResults: AnalysisResult[] = [];

        for (const analyzer of this.analyzers) {
            try {
                const analyzerResults = await analyzer.analyze(tree);
                allResults.push(...analyzerResults);
            } catch (error) {
                console.error(`Error running analyzer '${analyzer.name}' on file '${filePath}':`, error);
                allResults.push({
                    type: 'analyzer-error',
                    severity: 'error',
                    message: `Analyzer '${analyzer.name}' failed on file '${filePath}': ${error instanceof Error ? error.message : String(error)}`,
                    context: { file: filePath }
                });
            }
        }

        return allResults;
    }
} 