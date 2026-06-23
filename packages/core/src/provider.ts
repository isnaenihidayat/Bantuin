export type ChatRole = "system" | "user" | "assistant" | "tool";

export type ChatImage = {
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  data: string;
};

export type ChatMessage = {
  role: ChatRole;
  content: string;
  images?: ChatImage[];
  name?: string;
  toolCallId?: string;
};

export type ChatRequest = {
  requestId: string;
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
};

export type ProviderUsage = {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  estimatedCost?: number;
};

export type ChatStreamEvent =
  | { type: "message.delta"; delta: string }
  | { type: "message.usage"; usage: ProviderUsage }
  | { type: "message.completed"; finishReason: string; providerRequestId?: string }
  | {
      type: "message.error";
      code: string;
      message: string;
      retryable: boolean;
      partial: boolean;
    };

export interface ModelProvider {
  readonly id: string;
  contextWindowTokens?(): Promise<number>;
  streamChat(
    request: ChatRequest,
    options?: { signal?: AbortSignal },
  ): AsyncIterable<ChatStreamEvent>;
}
