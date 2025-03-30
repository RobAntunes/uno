import { END, START, StateGraph } from "@langchain/langgraph";
import { ToolNode } from "@langchain/langgraph/prebuilt";
import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { ChatAnthropic } from "@langchain/anthropic";
// Import from the new local location
// eslint-disable-next-line @nx/enforce-module-boundaries
import { createTerminalTool } from "./tools/terminal.tool";
import { executeCommandInMainPty } from "../main"; // Import the executor function
import { MessagesState } from "./state"; // Should work if state.ts is in the same directory
import { BaseMessage } from "@langchain/core/messages";

// --- Environment Variable Check ---
if (!process.env.ANTHROPIC_API_KEY) {
  console.error("FATAL: ANTHROPIC_API_KEY environment variable is not set.");
  // Optionally, throw an error or exit the process in a real app
  // throw new Error("ANTHROPIC_API_KEY environment variable is not set.");
}

// --- Tool Setup ---
// Instantiate the terminal tool, injecting the execution logic from main.ts
const terminalTool = createTerminalTool(executeCommandInMainPty);
const tools = [terminalTool];
const toolNode = new ToolNode<MessagesState>(tools);

// --- Model Setup ---
// We should configure the model to use the tools
const model = new ChatAnthropic({
  temperature: 0,
  modelName: "claude-3-5-sonnet-20240620", // Or your preferred model
}).bindTools(tools);

// --- Agent Logic ---

// Define the function that calls the model
async function callModel(
  state: MessagesState,
): Promise<Partial<MessagesState>> {
  const { messages } = state;
  console.log("[Agent] Calling model with messages:", messages);
  const response = await model.invoke(messages);
  console.log("[Agent] Model response:", response);
  // We return a partial state object with the new message(s)
  return { messages: [response] };
}

// Define the function that determines whether to continue or use a tool
function shouldContinue(state: MessagesState): "tools" | typeof END {
  const { messages } = state;
  const lastMessage = messages[messages.length - 1];

  // Check if the last message is an AIMessage and has tool calls
  if (lastMessage instanceof AIMessage && lastMessage.tool_calls?.length) {
    console.log("[Agent] Routing to tools node");
    return "tools";
  }
  // Otherwise, end the execution cycle
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
  .addConditionalEdges(
    "agent", // Source node
    shouldContinue, // Function to determine the next node
    {
      tools: "tools", // If shouldContinue returns "tools", go to "tools"
      [END]: END, // If shouldContinue returns END, finish
    },
  )
  .addEdge("tools", "agent"); // After tools are executed, loop back to the agent

// --- Compile the Graph ---
const app = workflow.compile();

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

  // For simplicity now, we run without checkpointer/memory
  // Each invocation is independent. We can add memory later.
  const finalState = await app.invoke({ messages: [humanMessage] });

  console.log(
    `[Agent Runner] Final state for thread '${threadId || "default"}':`,
    finalState,
  );

  // Find the last AI message in the final state
  const lastAiMessage = finalState.messages
    ?.filter((m: AIMessage): m is AIMessage => m instanceof AIMessage)
    .pop();

  if (!lastAiMessage) {
    console.error("[Agent Runner] No AI message found in final state.");
    // Return a default error message or throw
    return new AIMessage(
      "Sorry, I encountered an issue processing your request.",
    );
  }

  return lastAiMessage; // Return the last AI message generated
}
