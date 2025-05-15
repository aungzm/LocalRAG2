import { useState, useEffect, useCallback } from "react";
import ChatSidebar from "../components/chat/ChatSidebar";
import FileSidebar from "../components/chat/FileSidebar";
import ChatArea from "../components/chat/ChatArea";
import {
  MessageSenderEnum,
  type ApiChatResponse,
  type ApiMessageResponse,
  type ApiLLMProviderResponse,
  type ApiWatchedFolderResponse,
  type Message,
  type ChatListItem,
  type ApiSendMessageResponse,
} from "../types";

const API_BASE_URL =
  import.meta.env.VITE_BASE_URL || "http://localhost:8000/api";
const API_V1_URL = `${API_BASE_URL}/v1`;

export default function ChatInterface() {
  // UI State
  const [leftSidebarOpen, setLeftSidebarOpen] = useState(true);
  const [rightSidebarOpen, setRightSidebarOpen] = useState(true);
  const [input, setInput] = useState("");

  // Data State
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatsForSidebar, setChatsForSidebar] = useState<ChatListItem[]>([]);
  const [fullChatsData, setFullChatsData] = useState<ApiChatResponse[]>([]);
  const [activeChatId, setActiveChatId] = useState<number | null>(null);
  const [isBotTyping, setIsBotTyping] = useState(false);

  // LLM Providers State
  const [availableLLMProviders, setAvailableLLMProviders] =
    useState<ApiLLMProviderResponse[]>([]);
  const [currentLLMProviderId, setCurrentLLMProviderId] = useState<number | null>(
    null
  );

  // Watched Folders State
  const [availableWatchedFolders, setAvailableWatchedFolders] =
    useState<ApiWatchedFolderResponse[]>([]);
  const [currentWatchedFolderId, setCurrentWatchedFolderId] = useState<number | null>(
    null
  );

  // Helper Functions for API data mapping
  const mapApiMessageToFrontend = (apiMsg: ApiMessageResponse): Message => ({
    id: apiMsg.id,
    role: apiMsg.sender === MessageSenderEnum.User ? "user" : "assistant",
    content: apiMsg.text,
    createdAt: apiMsg.createdAt,
  });

  const mapApiChatToChatListItem = (
    apiChat: ApiChatResponse
  ): ChatListItem => ({
    id: apiChat.id,
    title: apiChat.name,
    active: false, 
    llmProviderId: apiChat.llmProviderId, 
    watchedFolderId: apiChat.watchedFolderId, 
  });

  // API Call Functions
  const fetchLLMProviders = async () => {
    try {
      const response = await fetch(`${API_V1_URL}/llm-providers`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiLLMProviderResponse[] = await response.json();
      setAvailableLLMProviders(data);
      if (
        currentLLMProviderId &&
        !data.find((p) => p.id === currentLLMProviderId)
      ) {
        setCurrentLLMProviderId(null); // Clear if selected provider is gone
      }
    } catch (error) {
      console.error("Failed to fetch LLM providers:", error);
    }
  };

  const fetchWatchedFolders = async () => {
    try {
      const response = await fetch(`${API_V1_URL}/watched-folders`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiWatchedFolderResponse[] = await response.json();
      setAvailableWatchedFolders(data);
      if (
        currentWatchedFolderId &&
        !data.find((f) => f.id === currentWatchedFolderId)
      ) {
        setCurrentWatchedFolderId(null); // Clear if selected folder is gone
      }
    } catch (error) {
      console.error("Failed to fetch watched folders:", error);
    }
  };

  const fetchChats = useCallback(async () => {
    try {
      const response = await fetch(`${API_V1_URL}/chats`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiChatResponse[] = await response.json();
      setFullChatsData(data);
      setChatsForSidebar(data.map(mapApiChatToChatListItem));

      // You can still leave in the check here if you want to handle deleted active chat, etc.
      if (data.length === 0) {
        setMessages([]);
        setActiveChatId(null);
        setCurrentLLMProviderId(null);
        setCurrentWatchedFolderId(null);
      } else if (activeChatId && !data.find((c) => c.id === activeChatId)) {
        selectChat(data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch chats:", error);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChatId]);

  const fetchMessagesForChat = async (chatId: number) => {
    try {
      const response = await fetch(`${API_V1_URL}/chats/${chatId}/messages`);
      if (!response.ok)
        throw new Error(`HTTP error! status: ${response.status}`);
      const data: ApiMessageResponse[] = await response.json();
      setMessages(data.map(mapApiMessageToFrontend));
    } catch (error) {
      console.error(`Failed to fetch messages for chat ${chatId}:`, error);
      setMessages([]);
    }
  };

  // --- Effects ---
  useEffect(() => {
    fetchLLMProviders();
    fetchWatchedFolders();
    fetchChats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  useEffect(() => {
    if (fullChatsData.length > 0 && !activeChatId) {
      // Auto-select the first chat when the chat list loads
      selectChat(fullChatsData[0].id);
    }
    
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fullChatsData, activeChatId]);

  // Event Handlers
  const selectChat = (id: number) => {
    setActiveChatId(id);
    fetchMessagesForChat(id);

    // Use the currently fetched data if available
    const selectedFullChat = fullChatsData.find((chat) => chat.id === id);
    if (selectedFullChat) {
      setCurrentLLMProviderId(selectedFullChat.llmProviderId);
      setCurrentWatchedFolderId(selectedFullChat.watchedFolderId);
    } else {
      setCurrentLLMProviderId(null);
      setCurrentWatchedFolderId(null);
    }
  };

  const createNewChat = async () => {
    const newChatName = `New Chat ${Date.now()}`;
    try {
      const response = await fetch(`${API_V1_URL}/chats`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newChatName }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorBody}`
        );
      }
      const newApiChat: ApiChatResponse = await response.json();
      setFullChatsData((prev) => [newApiChat, ...prev]);
      setChatsForSidebar((prevChats) => [
        mapApiChatToChatListItem(newApiChat),
        ...prevChats.map((c) => ({ ...c, active: false })),
      ]);
      selectChat(newApiChat.id);
    } catch (error) {
      console.error("Failed to create new chat:", error);
      alert(
        `Error creating chat: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleLLMProviderChange = async (newProviderId: number | null) => {
    setCurrentLLMProviderId(newProviderId);
    if (activeChatId && newProviderId !== null) {
      try {
        const response = await fetch(
          `${API_V1_URL}/chats/${activeChatId}/select-llm-provider`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ llm_provider_id: newProviderId }),
          }
        );
        if (!response.ok)
          throw new Error(`Failed to update LLM provider for chat`);
        const updatedChatData: ApiChatResponse = await response.json();
        setFullChatsData((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId ? updatedChatData : chat
          )
        );
        setChatsForSidebar((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? mapApiChatToChatListItem(updatedChatData)
              : chat
          )
        );
      } catch (error) {
        console.error("Error updating LLM provider:", error);
        alert(
          `Error saving LLM Provider: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else if (activeChatId && newProviderId === null) {
      console.warn(
        "Unselecting provider for an existing chat is not yet fully supported on backend."
      );
    }
  };

  const handleWatchedFolderChange = async (newFolderId: number | null) => {
    setCurrentWatchedFolderId(newFolderId);
    if (activeChatId && newFolderId !== null) {
      try {
        const response = await fetch(
          `${API_V1_URL}/chats/${activeChatId}/select-watched-folder`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ watched_folder_id: newFolderId }),
          }
        );
        if (!response.ok)
          throw new Error(`Failed to update watched folder for chat`);
        const updatedChatData: ApiChatResponse = await response.json();
        setFullChatsData((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId ? updatedChatData : chat
          )
        );
        setChatsForSidebar((prev) =>
          prev.map((chat) =>
            chat.id === activeChatId
              ? mapApiChatToChatListItem(updatedChatData)
              : chat
          )
        );
      } catch (error) {
        console.error("Error updating watched folder:", error);
        alert(
          `Error saving Watched Folder: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } else if (activeChatId && newFolderId === null) {
      console.warn(
        "Unselecting folder for an existing chat is not yet fully supported on backend."
      );
    }
  };

  const handleSendMessage = async () => {
    if (!currentLLMProviderId) {
      alert("Please select an LLM provider before sending a message.");
      return;
    }
    if (!currentWatchedFolderId) {
      alert("Please select a Watched Folder before sending a message.");
      return;
    }
    if (input.trim() === "") return;

    setIsBotTyping(true);

    const providerIdToSend: number = currentLLMProviderId;
    const folderIdToSend: number = currentWatchedFolderId;
    const chatIdToSend: number | null = activeChatId;
    const userMessageContent = input;

    const optimisticUserMessage: Message = {
      role: "user",
      content: userMessageContent,
      createdAt: new Date().toISOString(),
    };
    setMessages((prevMessages) => [...prevMessages, optimisticUserMessage]);
    setInput("");

    try {
      const response = await fetch(`${API_V1_URL}/chats/send-message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatIdToSend,
          text: userMessageContent,
          llm_provider_id: providerIdToSend,
          watched_folder_id: folderIdToSend,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, details: ${errorData}`
        );
      }
      const data: ApiSendMessageResponse = await response.json();

      setMessages((prevMessages) => {
        const messagesWithoutOptimistic = prevMessages.filter(
          (msg) =>
            msg.content !== userMessageContent ||
            msg.role !== "user" ||
            msg.id !== undefined
        );
        return [
          ...messagesWithoutOptimistic,
          mapApiMessageToFrontend(data.user_message),
          mapApiMessageToFrontend(data.bot_message),
        ];
      });

      if (!activeChatId && data.chat_id) {
        await fetchChats();
      }
    } catch (error) {
      console.error("Failed to send message:", error);
      alert(
        `Error sending message: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setMessages((prevMessages) =>
        prevMessages.filter(
          (msg) =>
            msg.content !== userMessageContent || msg.role !== "user"
        )
      );
    } finally {
      setIsBotTyping(false);
    }
  };

  // UI Toggles
  const toggleLeftSidebar = () => setLeftSidebarOpen(!leftSidebarOpen);
  const toggleRightSidebar = () => setRightSidebarOpen(!rightSidebarOpen);

  // Derived state for ChatSidebar
  const sidebarChatsToDisplay = chatsForSidebar.map((chat) => ({
    ...chat,
    active: chat.id === activeChatId,
  }));

  return (
    <div className="flex h-screen overflow-hidden bg-gray-100 text-gray-900">
      <ChatSidebar
        isOpen={leftSidebarOpen}
        toggleSidebar={toggleLeftSidebar}
        chats={sidebarChatsToDisplay}
        createNewChat={createNewChat}
        selectChat={selectChat}
      />

      <ChatArea
        messages={messages}
        input={input}
        setInput={setInput}
        handleSendMessage={handleSendMessage}
        llmProviders={availableLLMProviders}
        selectedLLMProviderId={currentLLMProviderId}
        onLLMProviderChange={handleLLMProviderChange}
        isSendDisabled={
          !currentLLMProviderId ||
          !currentWatchedFolderId ||
          input.trim() === ""
        }
        isBotTyping={isBotTyping}
      />

      <FileSidebar
        isOpen={rightSidebarOpen}
        toggleSidebar={toggleRightSidebar}
        watchedFolders={availableWatchedFolders}
        selectedWatchedFolderId={currentWatchedFolderId}
        onWatchedFolderChange={handleWatchedFolderChange}
      />
    </div>
  );
}
