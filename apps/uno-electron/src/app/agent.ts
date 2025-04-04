import {
  CompiledStateGraph,
  END,
  START,
  StateGraph,
} from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
// Import from the new local location
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTerminalTool } from "./tools/terminal.tool"; // <-- RE-ADD this import
import { codeAnalyzerTool } from "./tools/code_analyzer.tool"; // <-- RE-ADD this import
import { executeCommandInMainPty } from "../main"; // <-- RE-ADD this import
import { MessagesState } from "./state";
import { BaseMessage } from "@langchain/core/messages";
// --- Import MCP Adapter ---
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
// Remove only the unused DynamicTool import
import { StructuredToolInterface } from "@langchain/core/tools";
// --- REMOVE Electron Import ---
// import electron from 'electron';

// --- Add Node.js imports for file reading ---
import * as fs from "fs/promises";
import * as path from "path";

// --- Define config structures (interfaces McpServerConfigForAgent, McpConfigForAgent can remain) ---
interface McpServerConfigForAgent { // Ensure this interface matches mcp.json structure
  description?: string;
  active: boolean;
  command?: string;
  args?: string[];
  transport?: "stdio" | "sse";
  url?: string;
}
interface McpConfigForAgent {
  servers: Record<string, McpServerConfigForAgent>;
}

// --- Define path to mcp.json (relative to project root, assuming agent runs from dist/)
const MCP_CONFIG_PATH = path.resolve(__dirname, "../../../mcp.json"); // Adjust path as needed

// --- Environment Variable Check ---
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: ANTHROPIC_API_KEY environment variable is not set.");
  // Optionally, throw an error or exit the process in a real app
  // throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
}

// --- REMOVE IPC-based terminal tool function ---
/*
function createTerminalToolWithIPC() { ... }
*/

// --- Asynchronous Agent Setup ---
async function initializeAgent(): Promise<
  CompiledStateGraph<
    MessagesState,
    Partial<MessagesState>,
    "__start__" | "tools" | "agent"
  >
> {
  // --- Tool Setup ---
  // Instantiate the original terminal tool using direct function call
  console.log(
    "[Agent Setup] Creating terminal tool with direct function call...",
  );
  const terminalTool = createTerminalTool(executeCommandInMainPty); // <-- Use original tool
  console.log("[Agent Setup] Terminal tool created.");

  // --- MCP Tool Setup ---
  console.log(
    "[Agent Setup] Initializing MCP Client based on active servers...",
  );
  let activeMcpTools: StructuredToolInterface[] = [];

  try {
    // --- Read MCP config directly using Node FS ---
    console.log(
      `[Agent Setup] Reading MCP config directly from: ${MCP_CONFIG_PATH}`,
    );
    let mcpConfig: McpConfigForAgent = { servers: {} }; // Default to empty
    try {
      const fileContent = await fs.readFile(MCP_CONFIG_PATH, "utf-8");
      mcpConfig = JSON.parse(fileContent) as McpConfigForAgent;
      // Basic validation
      if (!mcpConfig || typeof mcpConfig.servers !== "object") {
        console.error(
          "[Agent Setup] Invalid MCP configuration format read from file.",
        );
        mcpConfig = { servers: {} }; // Reset to empty on invalid format
      } else {
        console.log(
          "[Agent Setup] Successfully read and parsed MCP config directly.",
        );
      }
    } catch (readError: any) {
      if (readError.code === "ENOENT") {
        console.warn(
          `[Agent Setup] MCP config file not found at ${MCP_CONFIG_PATH}. Proceeding without MCP tools.`,
        );
      } else {
        console.error(
          "[Agent Setup] Error reading or parsing MCP config directly:",
          readError,
        );
      }
      // Proceed with empty config if file read fails
      mcpConfig = { servers: {} };
    }
    // --- End direct config read ---

    // Filter active server definitions (logic remains the same)
    const activeServerConfigs: Record<string, any> = {};
    for (const [name, config] of Object.entries(mcpConfig.servers)) {
      const serverConfig = config as McpServerConfigForAgent;
      if (serverConfig.active) {
        activeServerConfigs[name] = serverConfig;
      }
    }

    if (Object.keys(activeServerConfigs).length > 0) {
      console.log(
        `[Agent Setup] Found ${
          Object.keys(activeServerConfigs).length
        } active MCP servers in config.`,
      );
      const mcpClient = new MultiServerMCPClient();
      mcpClient.addConnections(activeServerConfigs);

      await mcpClient.initializeConnections();
      activeMcpTools = mcpClient.getTools();
      console.log(
        `[Agent Setup] Initialized MCP Client for active servers, retrieved ${activeMcpTools.length} tools.`,
        activeMcpTools.map((tool) => tool.name),
      );
    } else {
      console.log(
        "[Agent Setup] No active MCP servers found in configuration.",
      );
    }
  } catch (error) {
    // This catch block now mainly handles MCPClient errors
    console.error(
      "[Agent Setup] Error during MCP Client initialization/connection:",
      error,
    );
    console.warn(
      "[Agent Setup] Proceeding with only the Terminal tool due to MCP initialization error.",
    );
    activeMcpTools = []; // Ensure it's empty on error
  }

  // Combine terminal tool and ACTIVE MCP tools
  const allTools: StructuredToolInterface[] = [
    terminalTool,
    codeAnalyzerTool,
    ...activeMcpTools,
  ];
  console.log(
    `[Agent Setup] Total tools available to agent: ${allTools.length}`,
    allTools.map((t) => t.name),
  );

  // Create the ToolNode with all tools
  const toolNode = new ToolNode<MessagesState>(allTools);

  // --- Model Setup ---
  const model = new ChatAnthropic({
    temperature: 0,
    modelName: "claude-3-5-sonnet-20240620",
  }).bindTools(allTools);

  // --- Agent Logic (callModel, shouldContinue remain the same) ---
  async function callModel(
    state: MessagesState,
  ): Promise<Partial<MessagesState>> {
    const { messages } = state;
    console.log("[Agent] Calling model with messages:", messages);
    const response = await model.invoke(messages);
    console.log("[Agent] Model response:", response);
    return { messages: [response] };
  }

  function shouldContinue(state: MessagesState): "tools" | typeof END {
    const { messages } = state;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
      console.log("[Agent] Routing to tools node");
      return "tools";
    }
    console.log("[Agent] Routing to END");
    return END;
  }

  // --- Graph Definition ---
  const workflow = new StateGraph<MessagesState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
    },
  })
    .addNode("agent", callModel)
    .addNode("tools", toolNode)
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent");

  // --- Compile the Graph ---
  const app = workflow.compile();
  console.log("[Agent Setup] Agent graph compiled successfully.");
  return app;
}

// --- Hold the compiled app (logic remains the same) ---
let compiledAppPromise:
  | Promise<
    CompiledStateGraph<
      MessagesState,
      Partial<MessagesState>,
      "__start__" | "tools" | "agent"
    >
  >
  | null = null;

async function getCompiledApp() {
  if (!compiledAppPromise) {
    console.log("[Agent Runner] Initializing agent for the first time...");
    compiledAppPromise = initializeAgent();
  }
  return compiledAppPromise;
}

// --- Interaction Function (logic remains the same, it's called by main.ts now) ---
export async function runAgentInteraction(
  inputMessageContent: string,
  threadId?: string,
): Promise<AIMessage> {
  const humanMessage = new HumanMessage(inputMessageContent);
  console.log(
    `[Agent Runner] Invoking agent for thread '${
      threadId || "default"
    }' with input:`,
    inputMessageContent,
  );

  try {
    const app = await getCompiledApp();
    if (!app) {
      console.error(
        "[Agent Runner] Failed to initialize the agent application.",
      );
      // Ensure we return an AIMessage on failure
      return new AIMessage(
        "Sorry, the agent could not be initialized properly.",
      );
    }

    const finalState = await app.invoke({ messages: [humanMessage] });

    console.log(
      `[Agent Runner] Final state for thread '${threadId || "default"}':`,
      finalState,
    );

    const lastAiMessage = finalState.messages
      ?.filter((m: BaseMessage): m is AIMessage => m instanceof AIMessage) // Type guard with explicit type for m
      .pop();

    if (!lastAiMessage) {
      console.error("[Agent Runner] No AI message found in final state.");
      return new AIMessage(
        "Sorry, I couldn't find an appropriate response.",
      );
    }

    return lastAiMessage;
  } catch (error: any) { // Catch specific error type
    console.error("[Agent Runner] Error during agent interaction:", error);
    return new AIMessage(
      `Sorry, I encountered an error while processing your request: ${error.message}`,
    );
  }
}
