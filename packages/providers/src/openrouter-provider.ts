import {
  AppError,
  type ChatMessage,
  type ChatRequest,
  type ChatStreamEvent,
  type ModelProvider,
} from "@bantuin/core";
import { OpenRouter } from "@openrouter/sdk";

export type OpenRouterProviderOptions = {
  apiKey: string;
  model: string;
  httpReferer?: string;
  appTitle: string;
};

function toOpenRouterMessage(message: ChatMessage) {
  if (message.role === "tool") {
    return {
      role: "tool" as const,
      content: message.content,
      toolCallId: message.toolCallId ?? "unknown",
    };
  }

  return {
    role: message.role,
    content: message.content,
    ...(message.name ? { name: message.name } : {}),
  };
}

function providerError(error: unknown): AppError {
  const status =
    typeof error === "object" && error !== null && "statusCode" in error
      ? Number(error.statusCode)
      : 503;

  if (status === 401) {
    return new AppError({
      code: "PROVIDER_AUTHENTICATION_FAILED",
      message: "OpenRouter authentication failed",
      status: 502,
      cause: error,
    });
  }

  if (status === 402) {
    return new AppError({
      code: "PROVIDER_CREDITS_EXHAUSTED",
      message: "OpenRouter credits are insufficient",
      status: 503,
      cause: error,
    });
  }

  if (status === 429) {
    return new AppError({
      code: "PROVIDER_RATE_LIMITED",
      message: "OpenRouter rate limit reached",
      status: 503,
      cause: error,
    });
  }

  return new AppError({
    code: "PROVIDER_UNAVAILABLE",
    message: "OpenRouter is temporarily unavailable",
    status: 503,
    cause: error,
  });
}

export class OpenRouterProvider implements ModelProvider {
  readonly id = "openrouter";
  readonly #client: OpenRouter;
  readonly #model: string;

  constructor(options: OpenRouterProviderOptions) {
    this.#model = options.model;
    this.#client = new OpenRouter({
      apiKey: options.apiKey,
      appTitle: options.appTitle,
      ...(options.httpReferer ? { httpReferer: options.httpReferer } : {}),
    });
  }

  async *streamChat(
    request: ChatRequest,
    options: { signal?: AbortSignal } = {},
  ): AsyncIterable<ChatStreamEvent> {
    try {
      const stream = await this.#client.chat.send(
        {
          chatRequest: {
            model: request.model ?? this.#model,
            messages: request.messages.map(toOpenRouterMessage),
            stream: true,
            ...(request.temperature === undefined ? {} : { temperature: request.temperature }),
            ...(request.maxTokens === undefined ? {} : { maxTokens: request.maxTokens }),
          },
        },
        options.signal ? { signal: options.signal } : undefined,
      );

      let providerRequestId: string | undefined;
      let finishReason = "stop";

      for await (const chunk of stream) {
        providerRequestId = chunk.id ?? providerRequestId;

        if ("error" in chunk && chunk.error) {
          yield {
            type: "message.error",
            code: String(chunk.error.code),
            message: chunk.error.message,
            retryable: true,
            partial: true,
          };
          return;
        }

        const choice = chunk.choices?.[0];
        const content = choice?.delta?.content;
        if (content) {
          yield { type: "message.delta", delta: content };
        }

        if (choice?.finishReason) {
          finishReason = choice.finishReason;
        }

        if (chunk.usage) {
          yield {
            type: "message.usage",
            usage: {
              inputTokens: chunk.usage.promptTokens,
              outputTokens: chunk.usage.completionTokens,
              totalTokens: chunk.usage.totalTokens,
              ...(typeof chunk.usage.cost === "number" ? { estimatedCost: chunk.usage.cost } : {}),
            },
          };
        }
      }

      yield {
        type: "message.completed",
        finishReason,
        ...(providerRequestId ? { providerRequestId } : {}),
      };
    } catch (error) {
      if (options.signal?.aborted) {
        throw options.signal.reason ?? new DOMException("Request aborted", "AbortError");
      }
      throw providerError(error);
    }
  }
}
