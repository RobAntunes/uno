import { AIMessage, HumanMessage } from "@langchain/core/messages";

// Simple message state for the agent graph
export interface MessagesState {
  messages: Array<HumanMessage | AIMessage>;
}

// We can expand this later with more state variables if needed
