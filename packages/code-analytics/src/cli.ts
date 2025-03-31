#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { CodeAnalytics, AnalysisResult } from './index'; // Assuming index exports necessary items
import path from 'path';
import chalk from 'chalk'; // For colored output
import fs from 'fs/promises'; // Import fs for file writing

// Helper function to format results
function formatResults(filePath: string, results: AnalysisResult[]): string {
    if (results.length === 0) {
        return chalk.green(`✓ No issues found in ${filePath}`);
    }

    let output = chalk.underline(filePath) + '\n';
    results.sort((a, b) => (a.location?.start.row ?? 0) - (b.location?.start.row ?? 0));

    for (const result of results) {
        const { severity, message, location, type, context } = result;
        const line = location ? location.start.row + 1 : 0;
        const col = location ? location.start.column + 1 : 0;
        const severityColor = severity === 'error' ? chalk.red : severity === 'warning' ? chalk.yellow : chalk.gray;

        output += `  ${chalk.dim(`${line}:${col}`)}  ${severityColor(severity.padEnd(7))} ${chalk.gray(`[${type}]`)} ${message}`; 
        if (context) {
            output += chalk.dim(` (${JSON.stringify(context)})`);
        }
        output += '\n';
    }
    return output;
}

async function runAnalysis(files: string[], outputJsonPath?: string) {
    const analytics = new CodeAnalytics();
    const allResultsMap = new Map<string, AnalysisResult[]>(); // Store results per file
    let totalIssues = 0;
    const issueCounts = { error: 0, warning: 0, info: 0 };

    console.log(chalk.blue(`Analyzing ${files.length} file(s)...\n`));

    for (const file of files) {
        try {
            const absolutePath = path.resolve(file);
            const results = await analytics.analyzeFile(absolutePath);
            allResultsMap.set(absolutePath, results); // Store results by absolute path
            
            // Count issues for summary
            totalIssues += results.length;
            results.forEach(r => {
                 if (r.severity === 'error') issueCounts.error++;
                 else if (r.severity === 'warning') issueCounts.warning++;
                 else if (r.severity === 'info') issueCounts.info++;
            });

            console.log(formatResults(file, results)); // Print formatted results to console
        } catch (error) {
            console.error(chalk.red(`Error analyzing file ${file}:`), error);
            totalIssues++; 
            issueCounts.error++;
            allResultsMap.set(path.resolve(file), [{ // Add error entry for JSON output
                 type: 'analysis-error',
                 severity: 'error',
                 message: `Failed to analyze file: ${error instanceof Error ? error.message : String(error)}`
            }]);
        }
    }

    // --- Write JSON Output if requested --- 
    if (outputJsonPath) {
        try {
            const outputData = { 
                analyzedAt: new Date().toISOString(),
                // Store relative paths in the output JSON for better portability
                results: Object.fromEntries(
                    Array.from(allResultsMap.entries()).map(([absPath, results]) => [
                        path.relative(process.cwd(), absPath),
                        results
                    ])
                ) 
             };
             // Resolve output path relative to CWD (workspace root ideally)
            const absoluteJsonPath = path.resolve(process.cwd(), outputJsonPath);
            await fs.writeFile(absoluteJsonPath, JSON.stringify(outputData, null, 2));
            console.log(chalk.blue(`\nJSON results saved to: ${absoluteJsonPath}`));
        } catch (error) {
            console.error(chalk.red(`\nError writing JSON output to ${outputJsonPath}:`), error);
        }
    }

    // --- Print Console Summary --- 
    console.log(chalk.bold('\nAnalysis Complete!'));
    if (totalIssues > 0) {
        let summary = chalk.red(`${issueCounts.error} error(s)`);
        summary += `, ${chalk.yellow(`${issueCounts.warning} warning(s)`)}`;
        summary += `, ${chalk.gray(`${issueCounts.info} info(s)`)}`;
        console.log(summary);
        // Optionally exit with non-zero code if errors found
        if (issueCounts.error > 0) process.exitCode = 1; 
    } else {
        console.log(chalk.green('✨ All files passed analysis!'));
    }
}

yargs(hideBin(process.argv))
    .command(
        '$0 <files...>', 
        'Analyze specified source code files', 
        (yargs) => {
            return yargs
                .positional('files', {
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
            const filesInput = argv.files;
            const files: string[] = Array.isArray(filesInput) ? filesInput.map(String) : (typeof filesInput === 'string' ? [filesInput] : []);
            const outputJsonPath = argv.outputJson as string | undefined;

            if (files.length > 0) {
                await runAnalysis(files, outputJsonPath);
            } else {
                console.error(chalk.red('Error: No valid files specified.'));
                process.exit(1);
            }
        }
    )
    .help()
    .alias('h', 'help')
    .strict()
    .parse(); 