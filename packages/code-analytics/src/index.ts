import { CodeParser } from './parser/parser';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';
import { DependencyVulnerabilityAnalyzer } from './analyzers/dependencyVulnerability';
import { SecretsAnalyzer } from './analyzers/secretsAnalyzer';
import { SyncFsOperationsAnalyzer } from './analyzers/syncFsOperationsAnalyzer';
import { ESLintAnalyzer } from './analyzers/eslintAnalyzer';
import { findProjectRoot } from './utils';
import fs from 'fs/promises';
import path from 'path';
import Parser from 'tree-sitter';
import TsParser from 'tree-sitter-typescript';
const { typescript: TypeScript } = TsParser;

export * from './types';
export { CodeParser } from './parser/parser';
export { DependencyVulnerabilityAnalyzer } from './analyzers/dependencyVulnerability';
export { SecretsAnalyzer } from './analyzers/secretsAnalyzer';
export { SyncFsOperationsAnalyzer } from './analyzers/syncFsOperationsAnalyzer';
export { ESLintAnalyzer } from './analyzers/eslintAnalyzer';

export class CodeAnalytics {
    private parser: Parser;
    private analyzers: CodeAnalyzer[];
    private projectRoot: string;
    private isInitialized = false;

    private constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
        
        this.parser = new Parser();
        this.parser.setLanguage(TypeScript);

        this.analyzers = [
            new DependencyVulnerabilityAnalyzer(),
            new ESLintAnalyzer(),
            new SecretsAnalyzer(),
            new SyncFsOperationsAnalyzer(),
        ];
        this.isInitialized = true;
    }

    static async create(initialPath: string = process.cwd()): Promise<CodeAnalytics> {
        const projectRoot = await findProjectRoot(initialPath);
        if (!projectRoot) {
            throw new Error("Project root could not be determined.");
        }
        return new CodeAnalytics(projectRoot);
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
    async analyzeFile(filePath: string): Promise<AnalysisResult[]> {
        const absoluteFilePath = path.resolve(this.projectRoot, filePath);
        let fileContent: string;
        try {
            fileContent = await fs.readFile(absoluteFilePath, 'utf-8');
        } catch (error: any) {
            console.error(`Error reading file ${absoluteFilePath}: ${error.message}`);
            return [{
                analyzer: 'file-reader',
                type: 'error',
                line: 0,
                message: `Failed to read file: ${error.message}`
            }];
        }

        const tree = this.parser.parse(fileContent);
        let allResults: AnalysisResult[] = [];
        const context: AnalysisContext = {
            filePath: absoluteFilePath,
            projectRoot: this.projectRoot,
            sourceCode: fileContent,
            tree: tree
        };

        for (const analyzer of this.analyzers) {
            if (analyzer instanceof DependencyVulnerabilityAnalyzer && path.basename(filePath) !== 'package.json') {
                continue;
            }
            if (analyzer instanceof ESLintAnalyzer) {
                // No need to skip, ESLint handles file types via its config
            }

            try {
                const results = await analyzer.analyze(tree, context);
                allResults = allResults.concat(results);
            } catch (error: any) {
                console.error(`Error running analyzer ${analyzer.name} on ${filePath}: ${error.message}`);
                allResults.push({
                    analyzer: analyzer.name,
                    type: 'error',
                    line: 0,
                    message: `Analyzer crashed: ${error.message}`,
                });
            }
        }

        return allResults;
    }
} 