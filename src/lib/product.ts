// The vendor product being integrated into the prospect's stack. Swap this profile to use POCForge for any product.
export interface ProductProfile {
  name: string;
  summary: string;
  integration: string;
  capabilities: string[];
}

export const TOKEN_FACTORY: ProductProfile = {
  name: "Nebius Token Factory",
  summary:
    "Managed inference for open models (NVIDIA Nemotron, Llama, Qwen, DeepSeek, GPT-OSS) with an OpenAI-compatible API, fine-tuning, and enterprise access controls.",
  integration: `OpenAI-compatible REST API.
Base URL: https://api.tokenfactory.nebius.com/v1/
Auth: Authorization: Bearer $NEBIUS_API_KEY
Chat: POST /chat/completions with {"model": "<id>", "messages": [...]}. Any OpenAI SDK works by setting base_url.
Embeddings: POST /embeddings.
Models (case-sensitive ids, read from env in generated code): MODEL_FAST for Nemotron Nano (cheap, high volume), MODEL_REASON for Nemotron Super/Ultra (reasoning).`,
  capabilities: [
    "Chat completions and tool calling",
    "Embeddings for search and RAG",
    "Batch and high-volume classification or extraction with small models",
    "Reasoning and agent workflows with large models",
    "LoRA / full fine-tuning on customer data",
  ],
};
