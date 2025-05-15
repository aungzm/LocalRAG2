export const LLMProviderTypeEnum = {
    OpenAI: "OpenAI",
    Ollama: "Ollama",
    Claude: "Claude",
    Gemini: "Gemini",
} as const;
export type LLMProviderTypeEnum = typeof LLMProviderTypeEnum[keyof typeof LLMProviderTypeEnum];

export const MessageSenderEnum = {
    User: "User",
    Assistant: "Assistant",
} as const;
export type MessageSenderEnum = typeof MessageSenderEnum[keyof typeof MessageSenderEnum];

export interface ApiLLMProviderResponse {
    id: number;
    name: string;
    type: LLMProviderTypeEnum;
    modelName: string;
    apiUrl: string | null;
    apiKey: string | null;
    embeddingType: string;
    createdAt: string;
    updatedAt: string;
}

export interface ApiFileResponse {
    id: number;
    name: string;
    relativePath: string;
    fileHash: string;
    watchedFolderId: number;
    createdAt: string;
    updatedAt: string;
}

export interface WatchedFolderCreatePayload {
  path: string;
  vectorDbFilename: string;
  vectorDbLocation: string;
}


export interface LLMProviderCreatePayload {
  name: string;
  type: LLMProviderTypeEnum; // Send the string value of the enum
  apiKey?: string | null; // Optional
  apiUrl?: string | null; // Optional
  modelName: string;
  embeddingType: string;
}

export interface ApiWatchedFolderResponse {
    id: number;
    name: string;
    llmProviderId: number;
    path: string;
    vectorDbFilename: string;
    vectorDbLocation: string;
    folderHash: string;
    files: ApiFileResponse[];
    createdAt: string;
    updatedAt: string;
}

export interface ApiMessageResponse {
    id: number;
    text: string;
    sender: MessageSenderEnum;
    createdAt: string;
    chatId: number;
}

export interface ApiChatResponse {
    id: number;
    name: string;
    llmProviderId: number | null;
    watchedFolderId: number | null;
    llmProvider: ApiLLMProviderResponse | null;
    watchedFolder: ApiWatchedFolderResponse | null;
    messages: ApiMessageResponse[];
    createdAt: string;
    updatedAt: string;
}

export interface ApiSendMessageResponse {
    chat_id: number;
    user_message: ApiMessageResponse;
    bot_message: ApiMessageResponse;
}

export type MessageRole = "user" | "assistant";

export interface Message {
    id?: number;
    role: MessageRole;
    content: string;
    createdAt?: string;
}

export interface ChatListItem {
    id: number;
    title: string;
    active: boolean;
    llmProviderId: number | null;
    watchedFolderId: number | null;
}

export interface FileItem {
    id: number;
    name: string;
    type: string;
}

export interface LLMProviderUpdatePayload {
  name?: string;
  type?: LLMProviderTypeEnum;
  apiKey?: string | null;
  apiUrl?: string | null;
  modelName?: string;
  embeddingType?: string;
}

export interface WatchedFolderUpdatePayload {
  path?: string;
  name?: string;
  llmProviderId?: number;    
}