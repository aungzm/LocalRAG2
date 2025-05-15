from datetime import datetime, timezone
from typing import List, Optional, Any
import os
from prisma import Prisma
from prisma.models import Chat, LLMProvider, WatchedFolder # Ensure LLMProvider is imported
from helpers.llm_integrator import query_rag
from services.watched_folder import WatchedFolderService
import logging
from dotenv import load_dotenv
load_dotenv()
VECTOR_DB_COLLECTION_NAME = os.getenv("VECTOR_DB_COLLECTION_NAME")

logger = logging.getLogger(__name__)

class ChatService:
    """
    Service class for performing CRUD operations with Chat records, as well as
    handling the sending of messages with Retrieval-Augmented Generation (RAG).

    Additional functionalities include:
      - Retrieving available LLM providers and Watched Folders.
      - Updating the Chat's associated LLM provider or WatchedFolder.
      - Sending a message: if a Chat does not exist, one is created. Then RAG is
        invoked to generate a bot response.
    """

    def __init__(self, db_client: Prisma) -> None:
        self.db = db_client

    async def create_chat(self, chat_data: dict) -> Optional[Chat]:
        """
        Create a new Chat record with the provided data. Initial chat data would
        have name. llmProviderId and watchedFolderId are set later.
        Prisma handles createdAt and updatedAt if schema is configured.
        """
        try:
            # chat_data is expected to be like {"name": "New Chat Name"}
            # If llm_provider_id and watched_folder_id are passed, connect them
            data_to_create = {"name": chat_data.get("name", "New Chat")}
            if chat_data.get("llmProviderId"):
                data_to_create["llmProvider"] = {"connect": {"id": chat_data["llmProviderId"]}}
            if chat_data.get("watchedFolderId"):
                data_to_create["watchedFolder"] = {"connect": {"id": chat_data["watchedFolderId"]}}

            chat = await self.db.chat.create(
                data=data_to_create,
                include={
                    "messages": True,
                    "llmProvider": True,
                    "watchedFolder": {
                        "include": {
                            "files": True
                        }
                    }
                }
            )
            return chat
        except Exception as e:
            logging.error(f"Error creating chat: {e}", exc_info=True)
            return None

    async def get_chat(self, chat_id: int) -> Optional[Chat]:
        """
        Retrieve a Chat by its ID, including associated messages, LLM provider,
        and watched folder (with its files).
        """
        return await self.db.chat.find_unique(
            where={"id": chat_id},
            include={
                "messages": True,
                "llmProvider": True,
                "watchedFolder": {
                    "include": {
                        "files": True
                    }
                }
            }
        )

    async def list_all_chats(self) -> List[Chat]:
        """
        Retrieve all Chat records, including watched folders and their files.
        """
        return await self.db.chat.find_many(
            include={
                "messages": True,
                "llmProvider": True,
                "watchedFolder": {
                    "include": {
                        "files": True
                    }
                }
            },
            order={"updatedAt": "desc"} # Optional: order by most recently updated
        )

    async def update_chat(self, chat_id: int, update_data: Any) -> Optional[Chat]:
        """
        Update a Chat record with the given data.
        """
        try:
            updated_chat = await self.db.chat.update(
                where={"id": chat_id},
                data=update_data,
                include={ # Ensure response includes nested objects
                    "messages": True,
                    "llmProvider": True,
                    "watchedFolder": {"include": {"files": True}}
                }
            )
            return updated_chat
        except Exception as e:
            logging.error(f"Error updating chat (ID: {chat_id}): {e}", exc_info=True)
            return None

    async def delete_chat(self, chat_id: int) -> Optional[Chat]:
        """
        Delete a Chat record by its ID.
        """
        try:
            # It's good practice to ensure messages are deleted due to onDelete: Cascade
            # but Prisma handles this based on schema.
            deleted_chat = await self.db.chat.delete(
                where={"id": chat_id}
            )
            return deleted_chat
        except Exception as e:
            logging.error(f"Error deleting chat (ID: {chat_id}): {e}", exc_info=True)
            return None

    async def get_available_llm_providers(self) -> List[LLMProvider]:
        """
        Retrieve all available LLMProvider records.
        """
        return await self.db.llmprovider.find_many()

    async def get_available_watched_folders(self) -> List[WatchedFolder]:
        """
        Retrieve all available WatchedFolder records.
        """
        return await self.db.watchedfolder.find_many(include={"llmProvider": True})


    async def select_llm_provider(self, chat_id: int, llm_provider_id: int) -> Optional[Chat]:
        """
        Associate an LLMProvider with the Chat.
        """
        try:
            updated_chat = await self.db.chat.update(
                where={"id": chat_id},
                data={"llmProvider": {"connect": {"id": llm_provider_id}}},
                include={
                    "messages": True,
                    "llmProvider": True,
                    "watchedFolder": {"include": {"files": True}}
                }
            )
            return updated_chat
        except Exception as e:
            logging.error(f"Error setting LLM provider for Chat (ID: {chat_id}): {e}", exc_info=True)
            return None

    async def select_watched_folder(self, chat_id: int, watched_folder_id: int) -> Optional[Chat]:
        """
        Associate a WatchedFolder with the Chat.
        """
        try:
            updated_chat = await self.db.chat.update(
                where={"id": chat_id},
                data={"watchedFolder": {"connect": {"id": watched_folder_id}}},
                include={
                    "messages": True,
                    "llmProvider": True,
                    "watchedFolder": {"include": {"files": True}}
                }
            )
            return updated_chat
        except Exception as e:
            logging.error(
                f"Error associating WatchedFolder (ID: {watched_folder_id}) with Chat (ID: {chat_id}): {e}",
                exc_info=True
            )
            return None

    async def send_message(
        self,
        chat_id: Optional[int],
        text: str,
        llm_provider_id: int,
        watched_folder_id: int
    ) -> dict:
        """
        Sends a message in a Chat with RAG capabilities.
        If chat_id is None, a new Chat will be created.
        """
        chat = None
        effective_llm_provider_id = llm_provider_id
        effective_watched_folder_id = watched_folder_id

        if chat_id:
            chat = await self.db.chat.find_unique(where={"id": chat_id})
            if not chat:
                 raise ValueError(f"Chat with id {chat_id} not found.")
            # Use the provider/folder associated with the existing chat
            if chat.llmProviderId:
                effective_llm_provider_id = chat.llmProviderId
            else: # Chat exists but no provider, this is an issue, try to update it
                await self.select_llm_provider(chat_id, llm_provider_id)

            if chat.watchedFolderId:
                effective_watched_folder_id = chat.watchedFolderId
            else: # Chat exists but no folder, try to update it
                await self.select_watched_folder(chat_id, watched_folder_id)
        else: # chat_id is None, create a new chat
            logger.info(f"Creating new chat with Provider ID: {effective_llm_provider_id}, Folder ID: {effective_watched_folder_id}")
            chat = await self.db.chat.create(
                data={
                    "name": f"Chat: {text[:30]}...", # Generate a name based on first message
                    "llmProvider": {"connect": {"id": effective_llm_provider_id}},
                    "watchedFolder": {"connect": {"id": effective_watched_folder_id}},
                }
            )
            chat_id = chat.id # Get the new chat ID

        # Retrieve LLMProvider and WatchedFolder records using effective IDs.
        provider = await self.db.llmprovider.find_unique(where={"id": effective_llm_provider_id})
        if provider is None:
            raise ValueError(f"LLMProvider with id {effective_llm_provider_id} not found.")

        watched_folder = await self.db.watchedfolder.find_unique(where={"id": effective_watched_folder_id})
        if watched_folder is None:
            raise ValueError(f"WatchedFolder with id {effective_watched_folder_id} not found.")

        logger.info(f"Checking for changes in WatchedFolder ID: {effective_watched_folder_id}")
        wf_service = WatchedFolderService(self.db)
        try:
            # The provider for check_changes should be the one associated with the WatchedFolder itself for consistency
            # If WatchedFolder has its own llmProviderId, use that. Otherwise, use the chat's provider.
            provider_for_check_changes_id = watched_folder.llmProviderId if watched_folder.llmProviderId else effective_llm_provider_id
            await wf_service.check_changes(effective_watched_folder_id, provider_for_check_changes_id)
        except Exception as e:
            logger.error(f"Failed to check/update vector DB for folder {effective_watched_folder_id}: {e}", exc_info=True)
            # Decide if this should prevent message sending or just log

        # Construct the unique persist directory for ChromaDB
        unique_persist_dir = os.path.join(watched_folder.vectorDbLocation, watched_folder.vectorDbFilename)

        # Call RAG to retrieve the bot response.
        logger.info(f"Performing RAG query for Chat ID: {chat_id}")
        response_text = query_rag(
            query_text=text,
            vector_store_persist_dir=unique_persist_dir,
            embedding_provider_details=provider,  # Provider for query embedding (could be watched_folder.llmProvider)
            llm_provider_details=provider,        # Provider for generation (chat's provider)  <--- CORRECTED
            llm_model=provider.modelName,
            n_results=5,
        )

        # Create a new user message.
        user_message = await self.db.message.create(
            data={
                "text": text,
                "sender": "User",
                "chat": {"connect": {"id": chat_id}}, # chat_id is now guaranteed to be set
            }
        )

        # Create a new bot message with the LLM's RAG response.
        bot_message = await self.db.message.create(
            data={
                "text": response_text,
                "sender": "Assistant",
                "chat": {"connect": {"id": chat_id}},
            }
        )

        # Update chat's updatedAt timestamp
        await self.db.chat.update(where={"id": chat_id}, data={"updatedAt": datetime.now(timezone.utc)})


        logger.info(f"Message sent successfully in Chat ID: {chat_id}")
        return {"chat_id": chat_id, "user_message": user_message, "bot_message": bot_message, "chat_name": chat.name if chat else "New Chat"}


    async def retrieve_chat_history(self, chat_id: int) -> List[dict]: # Should be List[Message] or List[ApiMessageResponse equivalent]
        """
        Retrieve the message history for a given chat.
        """
        chat = await self.db.chat.find_unique(
            where={"id": chat_id},
            include={"messages": {"orderBy": {"createdAt": "asc"}}} # Order messages
        )
        if not chat:
            raise ValueError(f"Chat with id {chat_id} not found.")

        return chat.messages if chat.messages else []
