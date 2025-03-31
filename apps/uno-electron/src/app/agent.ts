import { END, StateGraph, CompiledStateGraph, START } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
// Import from the new local location
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTerminalTool } from "./tools/terminal.tool";
import { executeCommandInMainPty } from "../main"; // Import the executor function
import { MessagesState } from "./state"; // Should work if state.ts is in the same directory
import { BaseMessage } from "@langchain/core/messages";
// --- Import MCP Adapter ---
import { MultiServerMCPClient } from "@langchain/mcp-adapters";
import { StructuredToolInterface } from "@langchain/core/tools"; // Use StructuredToolInterface
import * as path from 'node:path'; // Import the path module

// --- Environment Variable Check ---
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: ANTHROPIC_API_KEY environment variable is not set.");
  // Optionally, throw an error or exit the process in a real app
  // throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
}

// --- Asynchronous Agent Setup ---
// We need an async function to initialize MCP connections
// Explicitly type the return value with correct generic arguments, including node names
async function initializeAgent(): Promise<
  CompiledStateGraph<
    MessagesState,
    Partial<MessagesState>,
    "__start__" | "tools" | "agent" // Explicitly list node names
  >
> {
  // --- Tool Setup ---
  // Instantiate the terminal tool
  const terminalTool = createTerminalTool(executeCommandInMainPty);

  // --- MCP Tool Setup ---
  console.log("[Agent Setup] Initializing MCP Client from default mcp.json...");
  // Resolve the path relative to the current working directory
  const configPath = path.resolve(process.cwd(), 'mcp.json');
  console.log(`[Agent Setup] Attempting to load MCP config from: ${configPath}`);
  // Create client, using the resolved path
  const mcpClient = MultiServerMCPClient.fromConfigFile(configPath);
  let mcpTools: StructuredToolInterface[] = []; // Use StructuredToolInterface type
  try {
    await mcpClient.initializeConnections(); // Connect to servers defined in mcp.json
    mcpTools = mcpClient.getTools(); // Get tools from connected servers
    console.log(
      `[Agent Setup] Successfully initialized MCP Client and retrieved ${mcpTools.length} tools.`,
    );
    // Optional: Log the names of the retrieved tools
    console.log(
      "[Agent Setup] MCP Tools:",
      mcpTools.map((tool) => tool.name),
    );
  } catch (error) {
    console.error("[Agent Setup] Failed to initialize MCP Client:", error);
    // Decide how to handle failure: continue without MCP tools, or throw?
    // For now, we'll log the error and continue with only the terminal tool.
    console.warn(
      "[Agent Setup] Proceeding with only the Terminal tool due to MCP initialization error.",
    );
  }

  // Combine terminal tool and MCP tools
  const allTools: StructuredToolInterface[] = [terminalTool, ...mcpTools]; // Use StructuredToolInterface type
  console.log(
    `[Agent Setup] Total tools available: ${allTools.length}`,
    allTools.map((t) => t.name),
  );

  // Create the ToolNode with all tools
  const toolNode = new ToolNode<MessagesState>(allTools);

  // --- Model Setup ---
  // Configure the model to use all available tools
  const model = new ChatAnthropic({
    temperature: 0,
    modelName: "claude-3-5-sonnet-20240620",
  }).bindTools(allTools); // Bind *all* tools

  // --- Agent Logic ---
  // (callModel and shouldContinue remain largely the same, but use the 'model' and 'allTools' from this scope)

  async function callModel(
    state: MessagesState,
  ): Promise<Partial<MessagesState>> {
    const { messages } = state;
    console.log("[Agent] Calling model with messages:", messages);
    // Ensure the model defined in this scope is used
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
  // (Graph definition remains the same, but uses the nodes/functions defined above)
  const workflow = new StateGraph<MessagesState>({
    channels: {
      messages: {
        value: (x: BaseMessage[], y: BaseMessage[]) => x.concat(y),
        default: () => [],
      },
    },
  })
    .addNode("agent", callModel)
    .addNode("tools", toolNode) // Use the toolNode with all tools
    .addEdge(START, "agent")
    .addConditionalEdges("agent", shouldContinue, {
      tools: "tools",
      [END]: END,
    })
    .addEdge("tools", "agent");

  // --- Compile the Graph ---
  const app = workflow.compile();
  console.log("[Agent Setup] Agent graph compiled successfully.");
  return app; // Return the compiled app
}

// --- Hold the compiled app ---
// We use a promise to handle the async initialization
// Explicitly type the promise variable with correct generic arguments, including node names
let compiledAppPromise: Promise<
  CompiledStateGraph<
    MessagesState,
    Partial<MessagesState>,
    "__start__" | "tools" | "agent" // Explicitly list node names
  >
> | null = null;

async function getCompiledApp() {
  if (!compiledAppPromise) {
    console.log("[Agent Runner] Initializing agent for the first time...");
    compiledAppPromise = initializeAgent();
  }
  return compiledAppPromise;
}

// --- Interaction Function ---
export async function runAgentInteraction(
  inputMessageContent: string,
  threadId?: string, // Optional: For potential state management later
): Promise<AIMessage> {
  const humanMessage = new HumanMessage(inputMessageContent);
  console.log(
    `[Agent Runner] Invoking agent for thread '${
      threadId || "default"
    }' with input:`,
    inputMessageContent,
  );

  try {
    // Get the compiled app (waits for initialization if it's the first time)
    const app = await getCompiledApp();

    // Add check to ensure app is not null/undefined after initialization
    if (!app) {
      console.error("[Agent Runner] Failed to initialize the agent application.");
      return new AIMessage(
        "Sorry, the agent could not be initialized properly.",
      );
    }

    // Invoke the app
    const finalState = await app.invoke({ messages: [humanMessage] });

    console.log(
      `[Agent Runner] Final state for thread '${threadId || "default"}':`,
      finalState,
    );

    const lastAiMessage = finalState.messages
      ?.filter((m: AIMessage): m is AIMessage => m instanceof AIMessage)
      .pop();

    if (!lastAiMessage) {
      console.error("[Agent Runner] No AI message found in final state.");
      return new AIMessage(
        "Sorry, I couldn't find an appropriate response.",
      );
    }

    return lastAiMessage;
  } catch (error) {
    console.error("[Agent Runner] Error during agent interaction:", error);
    // Return a user-facing error message
    return new AIMessage(
      "Sorry, I encountered an error while processing your request.",
    );
  }
}
