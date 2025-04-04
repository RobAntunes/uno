import { ESLint } from 'eslint';
import { CodeAnalyzer, AnalysisResult, AnalysisContext } from './types';
import path from 'path';
import Parser from 'tree-sitter';

export class ESLintAnalyzer implements CodeAnalyzer {
    name = 'eslint';
    description = 'Runs ESLint using the project\'s configuration and reports all findings.';
    private eslint: ESLint | null = null;

    private async initializeESLint(projectRoot?: string): Promise<ESLint> {
        if (this.eslint) {
            return this.eslint;
        }
        if (!projectRoot) {
            throw new Error('Project root must be provided to initialize ESLint');
        }
        
        this.eslint = new ESLint({
            cwd: projectRoot,
            fix: false,
            cache: false,
            ignore: true,
            errorOnUnmatchedPattern: false,
        });
        return this.eslint;
    }

    async analyze(tree: Parser.Tree, context?: AnalysisContext): Promise<AnalysisResult[]> {
        if (!context?.filePath) {
            console.warn(`[${this.name}] Skipping: filePath not provided in context.`);
            return [];
        }
        if (!context?.projectRoot) {
             console.warn(`[${this.name}] Skipping: projectRoot not provided in context. ESLint needs this to find configuration.`);
            return [];
        }

        const filePath = context.filePath;
        const projectRoot = context.projectRoot;
        const results: AnalysisResult[] = [];

        try {
            const eslint = await this.initializeESLint(projectRoot);
            
            const configPath = await eslint.calculateConfigForFile(filePath);
            console.log(`[${this.name}] Using ESLint config for ${filePath}:`, configPath); 

            const lintResults = await eslint.lintFiles([filePath]);

            if (lintResults && lintResults.length > 0) {
                const fileResult = lintResults[0];
                console.log(`[${this.name}] Raw ESLint messages for ${path.relative(projectRoot, filePath)}:`, JSON.stringify(fileResult.messages, null, 2)); 
                
                for (const message of fileResult.messages) {
                    results.push({
                        analyzer: this.name, 
                        line: message.line || 0, 
                        type: message.severity === 2 ? 'error' : message.severity === 1 ? 'warning' : 'info',
                        message: `${message.message} (${message.ruleId || 'eslint'})`,
                        diagnostic: {
                            ruleId: message.ruleId,
                        }
                    });
                }
            }
        } catch (error: any) {
            console.error(`[${this.name}] Error running ESLint analysis on ${path.relative(projectRoot, filePath)}:`, error);
            results.push({
                analyzer: this.name,
                line: 0,
                type: 'error',
                message: `Failed to run ESLint analysis: ${error.message || 'Unknown ESLint error'}`,
                diagnostic: { rawError: String(error) }
            });
        }

        console.log(`[${this.name}] Formatted results for ${path.relative(projectRoot, filePath)}:`, JSON.stringify(results, null, 2)); 
        return results;
    }
} 