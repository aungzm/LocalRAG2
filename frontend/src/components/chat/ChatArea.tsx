import React from "react";
import { Send, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { type ApiLLMProviderResponse, type Message } from "../../types";

interface ChatAreaProps {
  messages: Message[];
  input: string;
  setInput: (value: string) => void;
  handleSendMessage: () => void;
  llmProviders: ApiLLMProviderResponse[];
  selectedLLMProviderId: number | null;
  onLLMProviderChange: (id: number) => void;
  isSendDisabled?: boolean;
  isBotTyping?: boolean; 
}

const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  input,
  setInput,
  handleSendMessage,
  llmProviders,
  selectedLLMProviderId,
  onLLMProviderChange,
  isBotTyping
}) => {
  const handleModelChange = (value: string) => {
    onLLMProviderChange(Number(value));
  };

  const currentProvider = llmProviders.find(
    (p) => p.id === selectedLLMProviderId
  );

  // Determine if the loading indicator should be shown.
  // Show it if:
  // 1. There is at least one message.
  // 2. The last message was sent by the user.
  // 3. The bot is generating its response.
  const lastMessage =
    messages.length > 0 ? messages[messages.length - 1] : null;
  const showBotLoading = lastMessage?.role === "user" && isBotTyping;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Model Selector Header */}
      <div className="p-4 border-b bg-white">
        <div className="flex flex-left">
          <div className="flex items-center space-x-2">
            <Select
              value={
                selectedLLMProviderId
                  ? String(selectedLLMProviderId)
                  : undefined
              }
              onValueChange={handleModelChange}
            >
              <SelectTrigger className="w-auto min-w-[150px] max-w-[300px]">
                <SelectValue placeholder="Select a model" />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectLabel>AI Models</SelectLabel>
                  {llmProviders.map((provider) => (
                    <SelectItem key={provider.id} value={String(provider.id)}>
                      {provider.modelName}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-3/4 p-3 rounded-lg ${
                message.role === "user"
                  ? "bg-blue-500 text-white"
                  : "bg-gray-200 text-gray-900"
              }`}
            >
              {message.content}
            </div>
          </div>
        ))}

        {/* Render loading animation if the last message is from the user */}
        {showBotLoading && (
          <div className="flex justify-start">
            <div className="max-w-3/4 p-3 rounded-lg bg-gray-200 text-gray-900 flex items-center">
              <Loader2 size={20} className="mr-2 animate-spin" />
              <span>Responding...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t bg-white">
        <div className="flex bg-white rounded-lg border overflow-hidden">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
            className="flex-1 px-4 py-2 outline-none"
            placeholder="Type a message..."
          />
          <button
            onClick={handleSendMessage}
            className="p-2 bg-blue-500 text-white hover:bg-blue-600"
            disabled={isBotTyping || false}
          >
            <Send size={20} />
          </button>
        </div>
        <div className="mt-1 text-xs text-gray-500 text-right">
          {currentProvider
            ? `Chatting with ${currentProvider.modelName}`
            : "No model selected"}
        </div>
      </div>
    </div>
  );
};

export default ChatArea;
