#!/usr/bin/env node

import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { AnalysisResult, AnalysisContext } from './analyzers/types';
import { CodeAnalytics, DependencyVulnerabilityAnalyzer } from './index';
import path from 'path';
import chalk from 'chalk'; // For colored output
import { findProjectRoot } from './utils'; // Import the new utility
import Parser from 'tree-sitter'; // Needed for dummy tree
import { glob } from 'glob'; // Use the promise-based glob directly
import fs from 'fs/promises'; // Use promise-based fs
import TsParser from 'tree-sitter-typescript'; // Added
const { typescript: TypeScript } = TsParser; // Added

// Define the structure for the categorized results
interface CategorizedResults {
  [analyzerName: string]: {
    [filePath: string]: AnalysisResult[];
  };
}

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

async function runAnalysis(outputFile: string, globPattern: string) {
  console.log('Starting analysis...');
  const startTime = Date.now();
  try {
    // Use static factory method to initialize CodeAnalytics
    const codeAnalytics = await CodeAnalytics.create(); // Assign directly
    
    // Re-find projectRoot for path operations within this function scope
    // and add a null check to satisfy the linter.
    const projectRoot = await findProjectRoot(process.cwd());
    if (!projectRoot) {
      // This should theoretically not happen if CodeAnalytics.create() succeeded,
      // but adding the check satisfies TypeScript.
      throw new Error("Project root became null unexpectedly after initialization.");
    }

    console.log(`Detected project root: ${projectRoot}`);
    const absoluteOutputFile = path.resolve(projectRoot, outputFile);
    console.log(`Output file will be: ${absoluteOutputFile}`);

    const resultsMap: CategorizedResults = {};
    let files: string[] = [];
    let analysisErrors = false;

    try {
      files = await glob(globPattern, { 
          cwd: projectRoot,
          absolute: true, 
          nodir: true, 
          ignore: [
              '**/node_modules/**', 
              '**/dist/**', 
              '**/build/**',
              path.relative(projectRoot, absoluteOutputFile) 
          ], 
      });
      console.log(`Found ${files.length} files matching the pattern.`);

    } catch (err) {
      console.error(chalk.red('Error finding files:'), err);
      process.exitCode = 1;
      return;
    }

    if (files.length === 0) {
      console.warn(chalk.yellow('No files found matching the pattern.'));
      // Still write an empty result file
    } else {
      const totalFiles = files.length;
      let processedFiles = 0;

      for (const file of files) {
        processedFiles++;
        const relativeFilePathForDisplay = path.relative(projectRoot, file);
        console.log(`Analyzing file ${processedFiles}/${totalFiles}: ${relativeFilePathForDisplay}`);
        
        try {
          const fileResults = await codeAnalytics.analyzeFile(file);
          if (fileResults.length > 0) {
            // Categorize results by analyzer name
            for (const result of fileResults) {
              const analyzerName = result.analyzer;
              const filePathKey = path.relative(projectRoot, file); // Use relative path for keys

              if (!resultsMap[analyzerName]) {
                resultsMap[analyzerName] = {};
              }
              if (!resultsMap[analyzerName][filePathKey]) {
                resultsMap[analyzerName][filePathKey] = [];
              }
              resultsMap[analyzerName][filePathKey].push(result);
            }
          }
        } catch (error: any) {
          analysisErrors = true; // Mark that an error occurred
          const analyzerName = 'analysis-error'; // Generic category for file processing errors
          const filePathKey = path.relative(projectRoot, file);
          console.error(chalk.red(`Error analyzing file ${relativeFilePathForDisplay}:`), error);

          if (!resultsMap[analyzerName]) {
            resultsMap[analyzerName] = {};
          }
          if (!resultsMap[analyzerName][filePathKey]) {
            resultsMap[analyzerName][filePathKey] = [];
          }
          resultsMap[analyzerName][filePathKey].push({
            analyzer: analyzerName,
            line: 0,
            type: 'error',
            message: `Failed to analyze file: ${error.message || 'Unknown error'}`,
            diagnostic: { rawError: String(error) },
          });
        }
      }
    }

    try {
      console.log('Writing analysis results...');
      console.log('Final results object being written:', JSON.stringify(resultsMap, null, 2));
      console.log(`Attempting to write to absolute path: ${absoluteOutputFile}`);
      // Use fs.promises.writeFile directly
      await fs.writeFile(absoluteOutputFile, JSON.stringify(resultsMap, null, 2));
      console.log(chalk.green(`Analysis results written to ${outputFile}`));
    } catch (err) {
      analysisErrors = true; // Mark error if writing fails
      console.error(chalk.red(`Error writing results file ${absoluteOutputFile}:`), err);
    }

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`Analysis finished in ${duration} seconds.`);

    if (analysisErrors) {
      console.error(chalk.red('Analysis completed with errors.'));
      process.exitCode = 1;
    } else {
      console.log(chalk.green('Analysis completed successfully.'));
      // process.exitCode will be 0 by default
    }
  } catch (error: any) {
    console.error(chalk.red('Error during analysis setup or execution:'), error);
    process.exitCode = 1;
    return;
  }
}

const parsedArgs = yargs(hideBin(process.argv))
  .command(
    'analyze <outputFile> <globPattern>', // Define positional arguments
    'Run code analysis on files matching the glob pattern',
    (yargs) => {
      return yargs
        .positional('outputFile', { 
          describe: 'Path to the output JSON file', 
          type: 'string' 
        })
        .positional('globPattern', { 
          describe: 'Glob pattern to match files for analysis', 
          type: 'string' 
        })
    },
    async (argv) => {
      console.log(chalk.blue('Yargs command handler entered.'));
      // Ensure required arguments are provided (yargs does this, but belt-and-suspenders)
      if (!argv.outputFile || !argv.globPattern) {
        console.error(chalk.red('Error: Output file path and glob pattern are required.'));
        process.exit(1);
      }
      try {
          await runAnalysis(argv.outputFile, argv.globPattern);
      } catch (error: any) {
          console.error(`Error running analysis: ${error.message}`);
          process.exitCode = 1;
      }
    }
  )
  .demandCommand(1, 'You need at least one command before moving on')
  .help()
  .parseAsync(); // Execute the yargs setup asynchronously

// The assignment to parsedArgs makes this a statement, satisfying the linter. 