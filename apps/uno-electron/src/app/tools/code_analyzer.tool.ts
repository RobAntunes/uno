import { DynamicStructuredTool } from "@langchain/core/tools";
import { z } from "zod";
import { exec } from 'child_process';
import util from 'util';
import path from 'path';

// Promisify exec for async/await usage
const execPromise = util.promisify(exec);

// Define the schema for the tool's input
const CodeAnalyzerSchema = z.object({
  patterns: z.array(z.string()).optional().describe("Optional array of glob patterns specifying the files/directories to analyze relative to the project root. If omitted, a default full codebase scan is performed."),
});

// Create the tool instance
// Define default patterns for a full codebase scan
// These should target your primary source directories
const DEFAULT_PATTERNS = [
  '**/*.{ts,tsx}' // Simplified default: scan all ts/tsx files from root
];


// Create the tool instance
export const codeAnalyzerTool = new DynamicStructuredTool({
  name: "code_analyzer",
  description: "Runs a comprehensive code analysis (quality, security, performance patterns) on specified files/directories using glob patterns, or performs a default full codebase scan if no patterns are provided. Writes results to 'analysis-results.json' in the project root.",
  schema: CodeAnalyzerSchema,
  func: async ({ patterns: inputPatterns }: z.infer<typeof CodeAnalyzerSchema>) => {
    // Assume the agent executes tools from the workspace root
    const workspaceRoot = process.cwd(); // Or determine dynamically if needed
    const cliScriptPath = path.join('packages', 'code-analytics', 'dist', 'cli.js');
    const outputPath = path.join(workspaceRoot, 'analysis-results.json'); // Output to root

    // Use default patterns if none are provided or if the array is empty
    const effectivePatterns = (inputPatterns && inputPatterns.length > 0) ? inputPatterns : DEFAULT_PATTERNS;

    // Quote patterns for shell safety
    const quotedPatterns = effectivePatterns.map(p => `'${p.replace(/'/g, "'\\''")}'`).join(' ');

    // Construct the command
    const command = `node ${cliScriptPath} ${outputPath} ${quotedPatterns}`;
    console.log(`[code_analyzer_tool] Executing: ${command}`);

    try {
      // Execute the command
      // NOTE: This uses child_process.exec. If your agent uses a dedicated
      // terminal execution tool, you might need to adapt this func
      // to prepare arguments for that tool instead of executing directly.
      const { stdout, stderr } = await execPromise(command, { cwd: workspaceRoot });

      console.log(`[code_analyzer_tool] stdout:\n${stdout}`);
      if (stderr) {
        console.warn(`[code_analyzer_tool] stderr:\n${stderr}`);
        // Decide if stderr always means failure, or just warnings (like npm audit)
        // For now, let's return success even with stderr, as the script uses exit code.
      }

      // The script exits with 0 on success (even if issues found), 1 on error.
      // We might want to read the JSON output, but let's return a simple message for now.
      return `Code analysis completed successfully. Results saved to ${path.relative(workspaceRoot, outputPath)}. Stdout: ${stdout || 'None'}. Stderr: ${stderr || 'None'}`;

    } catch (error: any) {
      console.error(`[code_analyzer_tool] Execution failed:`, error);
      // Return a detailed error message
      return `Error executing code analyzer: ${error.message}. Exit Code: ${error.code}. Stderr: ${error.stderr || 'N/A'}. Stdout: ${error.stdout || 'N/A'}`;
    }
  },
});
