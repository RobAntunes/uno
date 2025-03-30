import { tool } from "@langchain/core/tools";
import { z } from "zod";

// Placeholder for the actual execution logic.
// This function will be effectively replaced by executeCommandInMainPty
// when the tool is instantiated in the main process.
const _executeTerminalCommandLogic = async (command: string): Promise<string> => {
    throw new Error(
        "Terminal command logic was not provided during tool initialization."
    );
};

// Define the type for the function we expect to be injected.
export type TerminalCommandExecutor = (command: string) => Promise<string>;

// Factory function to create the tool, allowing injection of the executor.
export const createTerminalTool = (executor: TerminalCommandExecutor) => tool(
    async ({ command }: { command: string }) => {
        try {
            // Call the injected executor function
            const result = await executor(command);
            return result;
        } catch (error: any) {
            console.error(`Error executing terminal command tool: ${error.message}`);
            return `Error executing command: ${error.message}`; // Return error message to the agent
        }
    },
    {
        name: "run_terminal_command",
        description: "Executes a shell command in the integrated terminal. Use this for file system operations, running scripts, git commands, etc. Output appears directly in the terminal view. Ensure commands are appropriately quoted if they contain spaces or special characters.",
        schema: z.object({
            command: z.string().describe("The shell command string to execute."),
        }),
    }
);

// We keep a default export for potential direct use cases,
// but it will error out unless logic is provided.
export const runTerminalCommandTool = createTerminalTool(_executeTerminalCommandLogic);
