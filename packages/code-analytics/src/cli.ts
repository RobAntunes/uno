#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AnalysisResult, AnalysisContext } from './analyzers/types';
import { CodeAnalytics, DependencyVulnerabilityAnalyzer, CodeAnalyzer } from './index';
import path from 'path';
import chalk from 'chalk'; // For colored output
import fs from 'fs/promises'; // Import fs for file writing
import { findProjectRoot } from './utils'; // Import the new utility
import Parser from 'tree-sitter'; // Needed for dummy tree
import { glob } from 'glob'; // Import glob

// Helper function to format results
function formatResults(filePath: string, results: AnalysisResult[]): string {
    if (results.length === 0) {
        return chalk.green(`✓ No issues found in ${filePath}`);
    }

    let output = chalk.underline(filePath) + '\n';
    // Sort by line number
    results.sort((a, b) => a.line - b.line);

    for (const result of results) {
        // Use properties from the new interface
        const { type, message, line, analyzer, diagnostic } = result; 
        const color = type === 'error' ? chalk.red : type === 'warning' ? chalk.yellow : chalk.gray;
        const typeLabel = type.toUpperCase();

        // Format the output line
        output += `  ${chalk.dim(`${line}:0`)}  ${color(typeLabel.padEnd(7))} ${chalk.gray(`[${analyzer}]`)} ${message}`; 
        if (diagnostic) {
            // Optionally include diagnostic info (condensed)
            output += chalk.dim(` (${JSON.stringify(diagnostic)})`); 
        }
        output += '\n';
    }
    return output;
}

async function runAnalysis(filePatterns: string[], outputJsonPath?: string) {
    
    // --- Expand Glob Patterns --- 
    let files: string[] = [];
    // Determine project root *before* globbing to use it as cwd
    let tempStartPath = process.cwd(); // Default if no patterns
    if (filePatterns.length > 0) {
        // Try to resolve the first pattern segment relative to cwd for root finding
        // This isn't perfect but better than using the pattern directly
        tempStartPath = path.resolve(filePatterns[0].split('/')[0]);
    }
    let projectRoot = await findProjectRoot(tempStartPath) ?? process.cwd(); // Find root first
    console.log(chalk.magenta(`Using project root for glob: ${projectRoot}`)); // Log the root used for glob

    try {
        // Pass projectRoot as cwd to glob
        files = (await glob(filePatterns, { nodir: true, absolute: true, cwd: projectRoot })).map(p => path.normalize(p));
        if (files.length === 0) {
             console.warn(chalk.yellow(`Warning: No files matched the patterns: ${filePatterns.join(', ')} (in ${projectRoot})`));
            process.exit(0); // Exit cleanly if no files match
        }
        console.log(chalk.blue(`Analyzing ${files.length} file(s)...`)); 
    } catch (err) {
        console.error(chalk.red('Error expanding file patterns:'), err);
        process.exit(1);
    }
    // --- End Expand Glob Patterns ---

    console.log(chalk.blue(`Starting analysis for files: ${files.map(f => path.relative(projectRoot, f)).join(', ')}`)); // Log relative paths

    // --- Determine Project Root --- (We already have it from above)
    // let projectRoot: string | null = null; <-- Remove redundant detection
    // if (files.length > 0) { ... } <-- Remove redundant detection
    
    if (!projectRoot) { // Should not happen if glob worked, but keep as safety
        console.warn(chalk.yellow("Could not determine project root. Falling back to current working directory."));
        projectRoot = process.cwd();
    } else {
        console.log(chalk.green(`Using confirmed project root: ${projectRoot}`));
    }
    // --- End Determine Project Root ---

    const codeAnalytics = new CodeAnalytics();
    const resultsMap: { [filePath: string]: AnalysisResult[] } = {};
    let hasErrors = false;
    let hasWarnings = false;

    for (const file of files) {
        const absoluteFilePath = path.resolve(projectRoot, file); // Resolve relative to project root
        console.log(chalk.cyan(`Analyzing file: ${path.relative(projectRoot, absoluteFilePath)}`)); // Log relative path
        try {
            const fileResults = await codeAnalytics.analyzeFile(absoluteFilePath, projectRoot); // Pass projectRoot
            const relativePath = path.relative(projectRoot, absoluteFilePath);
            resultsMap[relativePath] = fileResults;
            fileResults.forEach(result => {
                if (result.type === 'error') hasErrors = true;
                if (result.type === 'warning') hasWarnings = true;
            });
        } catch (error) {
            console.error(chalk.red(`Error analyzing file ${file}:`), error);
            resultsMap[path.relative(projectRoot, absoluteFilePath)] = [{
                analyzer: 'cli',
                message: `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`,
                type: 'error',
                line: 0, // Indicate general file error
                diagnostic: null
            }];
            hasErrors = true;
        }
    }

    // --- Run Dependency Vulnerability Check ---
    console.log(chalk.cyan('Running dependency vulnerability check...'));
    const depAnalyzer = codeAnalytics.getAnalyzers().find((a: CodeAnalyzer) => a instanceof DependencyVulnerabilityAnalyzer) as DependencyVulnerabilityAnalyzer | undefined;
    if (depAnalyzer) {
        try {
            // Dependency analyzer needs context, including projectRoot.
            // It doesn't need a real tree for its current logic.
            const dummyParser = new Parser(); // Create a dummy parser instance
            // You might need to set a language if the analyzer expects it, even if unused.
            // Let's assume TypeScript for now if needed, but ideally, the analyzer handles null/undefined tree gracefully.
            // dummyParser.setLanguage(/* some language object if needed */);
            const dummyTree = dummyParser.parse(''); // Create an empty tree

            const context: AnalysisContext = { projectRoot }; // Pass the determined project root
            const depResults = await depAnalyzer.analyze(dummyTree, context);
            
            // Use a consistent key, like 'package.json', since it relates to dependencies
            const depKey = path.join(path.relative(projectRoot, projectRoot), 'package.json'); // Will result in 'package.json'
            resultsMap[depKey] = [...(resultsMap[depKey] || []), ...depResults];
            depResults.forEach(result => {
                if (result.type === 'error') hasErrors = true;
                if (result.type === 'warning') hasWarnings = true;
            });
             console.log(chalk.green('Dependency vulnerability check completed.'));
        } catch (error) {
            console.error(chalk.red('Error running dependency vulnerability check:'), error);
            const depKey = path.join(path.relative(projectRoot, projectRoot), 'package.json');
             resultsMap[depKey] = [...(resultsMap[depKey] || []), {
                 analyzer: 'dependency-vulnerability',
                 message: `Failed to run check: ${error instanceof Error ? error.message : String(error)}`,
                 type: 'error',
                 line: 0,
                 diagnostic: null
             }];
             hasErrors = true;
        }
    } else {
        console.warn(chalk.yellow('DependencyVulnerabilityAnalyzer not found or registered.'));
    }
    // --- End Dependency Vulnerability Check ---

    // --- Output Results ---
    console.log('\n--- Analysis Summary ---');
    let totalIssues = 0;
    for (const [filePath, fileResults] of Object.entries(resultsMap)) {
        if (fileResults.length > 0) {
            // Use the updated formatResults function for console output
            console.log(formatResults(filePath, fileResults));
            // We still need to count issues for the final summary/exit code, 
            // but formatResults now handles the detailed printing.
            totalIssues += fileResults.length;
             // Update hasErrors/hasWarnings based on the results in this file
             fileResults.forEach(result => {
                 if (result.type === 'error') hasErrors = true;
                 if (result.type === 'warning') hasWarnings = true;
             });
        }
    }

    if (totalIssues === 0) {
        console.log(chalk.green('No issues found.'));
    }
    console.log('----------------------');

    if (outputJsonPath) {
        try {
            // Resolve output path relative to the Current Working Directory, not the detected project root
            const absoluteOutputJsonPath = path.resolve(process.cwd(), outputJsonPath); 
            await fs.writeFile(absoluteOutputJsonPath, JSON.stringify(resultsMap, null, 2));
            // Log the path relative to CWD for clarity
            console.log(chalk.green(`Analysis results saved to: ${path.relative(process.cwd(), absoluteOutputJsonPath)}`));
        } catch (error) {
             console.error(chalk.red(`Failed to write JSON output to ${outputJsonPath}:`), error);
        }
    }
    // --- End Output Results ---

    // Exit with non-zero code if errors were found
    process.exit(hasErrors ? 1 : 0);
}

yargs(hideBin(process.argv))
    .command(
        '$0 <patterns...>', // Rename positional argument
        'Analyze specified source code files or patterns', 
        (yargs) => {
            return yargs
                .positional('patterns', { // Rename positional argument
                    describe: 'List of files or glob patterns to analyze',
                    type: 'string',
                    demandOption: true,
                })
                .option('output-json', {
                     alias: 'o',
                     type: 'string',
                     description: 'Specify a file path to output results as JSON'
                });
        },
        async (argv) => {
            const patternsInput = argv.patterns as string[] | string | undefined;
            // Ensure patterns is an array of strings
            const patterns: string[] = Array.isArray(patternsInput) ? patternsInput : 
                                        (typeof patternsInput === 'string' ? [patternsInput] : []);
            const outputJsonPath = argv.outputJson as string | undefined;

            if (patterns.length > 0) {
                await runAnalysis(patterns, outputJsonPath); // Pass patterns
            } else {
                console.error(chalk.red('Error: No files or patterns specified.'));
                process.exit(1);
            }
        }
    )
    .help()
    .alias('h', 'help')
    .strict()
    .parse(); 