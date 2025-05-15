# routes/schemas.py
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from enum import Enum
from datetime import datetime

# Enums
class LLMProviderTypeEnum(str, Enum):
    OpenAI = "OpenAI"
    Ollama = "Ollama"
    Claude = "Claude"
    Gemini = "Gemini"

class MessageSenderEnum(str, Enum):
    User = "User"
    Assistant = "Assistant"

# LLMProvider Schemas
class LLMProviderBase(BaseModel):
    name: str = Field(..., min_length=1)
    type: LLMProviderTypeEnum
    api_key: Optional[str] = Field(None, alias="apiKey")
    api_url: Optional[str] = Field(None, alias="apiUrl")
    model_name: str = Field(..., min_length=1, alias="modelName")
    embedding_type: str = Field(..., min_length=1, alias="embeddingType")

class LLMProviderCreate(LLMProviderBase):
    pass

class LLMProviderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    type: Optional[LLMProviderTypeEnum] = None
    api_key: Optional[str] = Field(None, description="API key, can be empty if not applicable.", alias="apiKey")
    api_url: Optional[str] = Field(None, description="API URL, can be empty if not applicable or uses a default.", alias="apiUrl")
    model_name: Optional[str] = Field(None, min_length=1, alias="modelName")
    embedding_type: Optional[str] = Field(None, min_length=1, alias="embeddingType")

    class Config:
        populate_by_name = True # Allow using field name or alias for input
        from_attributes = True # For ORM mode if ever needed, good practice

class LLMProviderResponse(LLMProviderBase):
    id: int
    api_key: Optional[str] = Field(None, exclude=True) # Exclude API key from response
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True # For ORM mode
        populate_by_name = True # To handle aliases correctly

# File Schemas
class FileResponse(BaseModel):
    id: int
    name: str
    relative_path: str = Field(..., alias="relativePath")
    file_hash: str = Field(..., alias="fileHash")
    watched_folder_id: int = Field(..., alias="watchedFolderId")
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True
        populate_by_name = True

# WatchedFolder Schemas (UPDATED)
class WatchedFolderBase(BaseModel):
    name: str = Field(..., min_length=1, description="Display name for the watched folder")
    path: str = Field(..., min_length=1)
    vector_db_filename: str = Field(
        ...,
        min_length=1,
        description="Unique identifier for the folder's vector DB (used as sub-directory name)",
        alias="vectorDbFilename"
    )
    vector_db_location: str = Field(
        ...,
        min_length=1,
        description="Base path for storing vector DBs",
        alias="vectorDbLocation"
    )
    llm_provider_id: int = Field(..., alias="llmProviderId", description="ID of the LLM provider for embeddings")

class WatchedFolderCreate(WatchedFolderBase):
    # Inherits all fields from WatchedFolderBase
    # Frontend will send 'name', 'path', 'vectorDbFilename', 'vectorDbLocation', 'llmProviderId'
    # Pydantic will map 'vectorDbFilename' from request to 'vector_db_filename' attribute, etc.
    # if populate_by_name = True is set in Config, or if aliases are used consistently.
    # For request bodies, FastAPI handles aliases automatically.
    pass

class WatchedFolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1)
    path: Optional[str] = Field(None, min_length=1)
    llm_provider_id: Optional[int] = Field(None, alias="llmProviderId")
    # vector_db_filename and vector_db_location are typically not changed after creation.
    # If they need to be, it often implies re-indexing or a new DB.

    class Config:
        populate_by_name = True # Allows sending 'llmProviderId' in request body
        from_attributes = True

class WatchedFolderResponse(WatchedFolderBase): # Inherits name, path, vectorDbFilename, vectorDbLocation, llmProviderId
    id: int
    folder_hash: str = Field(..., alias="folderHash")
    files: List[FileResponse] = []
    llm_provider: Optional[LLMProviderResponse] = Field(None, alias="llmProvider") # For returning nested provider details
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True # For ORM mode
        populate_by_name = True # To handle aliases correctly

# Message Schemas
class MessageBase(BaseModel):
    text: str
    sender: MessageSenderEnum

class MessageResponse(MessageBase):
    id: int
    created_at: datetime = Field(..., alias="createdAt")
    chat_id: int = Field(..., alias="chatId")

    class Config:
        from_attributes = True
        populate_by_name = True

# Chat Schemas
class ChatBase(BaseModel):
    name: str = Field(..., min_length=1)

class ChatCreateRequest(BaseModel): # Used for creating a new chat
    name: str = Field(..., min_length=1)
    llm_provider_id: Optional[int] = Field(None, alias="llmProviderId")
    watched_folder_id: Optional[int] = Field(None, alias="watchedFolderId")

class ChatUpdate(BaseModel): # Used for updating an existing chat
    name: Optional[str] = Field(None, min_length=1)
    llm_provider_id: Optional[int] = Field(None, alias="llmProviderId")
    watched_folder_id: Optional[int] = Field(None, alias="watchedFolderId")

    class Config:
        populate_by_name = True
        from_attributes = True

class ChatResponse(ChatBase):
    id: int
    llm_provider_id: Optional[int] = Field(None, alias="llmProviderId")
    watched_folder_id: Optional[int] = Field(None, alias="watchedFolderId")
    llm_provider: Optional[LLMProviderResponse] = Field(None, alias="llmProvider")
    watched_folder: Optional[WatchedFolderResponse] = Field(None, alias="watchedFolder")
    messages: List[MessageResponse] = []
    created_at: datetime = Field(..., alias="createdAt")
    updated_at: datetime = Field(..., alias="updatedAt")

    class Config:
        from_attributes = True
        populate_by_name = True

# Specific Request/Response Schemas for Chat Operations
class SendMessageRequest(BaseModel):
    chat_id: Optional[int] = None # If None, a new chat might be created by the service
    text: str = Field(..., min_length=1)
    llm_provider_id: int = Field(..., alias="llmProviderId") # LLM for generation
    watched_folder_id: Optional[int] = Field(None, alias="watchedFolderId") # Folder for RAG context

    class Config:
        populate_by_name = True

class SendMessageResponse(BaseModel):
    chat_id: int
    user_message: MessageResponse
    bot_message: MessageResponse
    chat_name: Optional[str] = None # If a new chat was created

    class Config:
        from_attributes = True # If populated from an ORM-like object
        populate_by_name = True

# Schemas for Folder Operations
class CheckChangesRequest(BaseModel):
    # llm_provider_id is needed if re-indexing uses a specific provider's embeddings.
    # This should be the ID of the LLMProvider associated with the WatchedFolder.
    # The route might fetch this from the WatchedFolder itself rather than taking it as input.
    # For now, keeping it as per your previous definition.
    llm_provider_id: int = Field(..., alias="llmProviderId")

    class Config:
        populate_by_name = True

class CheckChangesResponse(BaseModel):
    folder_hash_changed: bool
    current_folder_hash: str
    current_files_state: List[dict] # Define a more specific model if possible
    added: List[dict]               # Define a more specific model if possible
    removed: List[dict]             # Define a more specific model if possible
    modified: List[dict]            # Define a more specific model if possible

# Schemas for selection in UI or other operations
class SelectLLMProviderRequest(BaseModel):
    llm_provider_id: int = Field(..., alias="llmProviderId")

    class Config:
        populate_by_name = True

class SelectWatchedFolderRequest(BaseModel):
    watched_folder_id: int = Field(..., alias="watchedFolderId")

    class Config:
        populate_by_name = True

class EmbeddingTypeResponse(BaseModel):
    provider_type: LLMProviderTypeEnum
    embedding_types: List[str]
