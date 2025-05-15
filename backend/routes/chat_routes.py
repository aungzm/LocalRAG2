from fastapi import APIRouter, Depends, HTTPException, status
from prisma import Prisma
from typing import List # Make sure List is imported from typing

from .schemas import (
    ChatCreateRequest, ChatUpdate, ChatResponse, SendMessageRequest, SendMessageResponse,
    SelectLLMProviderRequest, SelectWatchedFolderRequest,
    MessageResponse # Import MessageResponse if not already directly imported
)
from .dependencies import get_db
from services.chat import ChatService # Your existing service
from services.llm_provider import LLMProviderService
from services.watched_folder import WatchedFolderService


router = APIRouter()

@router.post("/", response_model=ChatResponse, status_code=status.HTTP_201_CREATED)
async def create_chat_endpoint( # Renamed function for clarity
    request_data: ChatCreateRequest, db: Prisma = Depends(get_db)
):
    service = ChatService(db)
    
    # Prepare the data for the service method
    chat_payload_for_service = {"name": request_data.name}
    
    created_chat = await service.create_chat(chat_payload_for_service)
    
    if not created_chat:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not create chat due to an internal service error."
        )
    
    return created_chat

@router.post("/send-message", response_model=SendMessageResponse)
async def send_chat_message(
    message_data: SendMessageRequest, db: Prisma = Depends(get_db)
):
    service = ChatService(db)
    try:
        # Ensure provider and folder exist before sending message if chat_id is None
        if message_data.chat_id is None:
            llm_service = LLMProviderService(db)
            if not await llm_service.get(message_data.llm_provider_id):
                raise HTTPException(status_code=404, detail=f"LLMProvider with id {message_data.llm_provider_id} not found.")
            wf_service = WatchedFolderService(db)
            if not await wf_service.get(message_data.watched_folder_id):
                raise HTTPException(status_code=404, detail=f"WatchedFolder with id {message_data.watched_folder_id} not found.")

        result = await service.send_message(
            chat_id=message_data.chat_id,
            text=message_data.text,
            llm_provider_id=message_data.llm_provider_id,
            watched_folder_id=message_data.watched_folder_id,
        )
        return result
    except ValueError as e: # From service if provider/folder not found for existing chat
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Log error e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Error sending message: {str(e)}")


@router.get("/{chat_id}", response_model=ChatResponse)
async def get_chat(chat_id: int, db: Prisma = Depends(get_db)):
    service = ChatService(db)
    chat = await service.get_chat(chat_id)
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    return chat

@router.get("/", response_model=List[ChatResponse])
async def list_chats(db: Prisma = Depends(get_db)):
    service = ChatService(db)
    return await service.list_all_chats()

@router.put("/{chat_id}", response_model=ChatResponse)
async def update_chat_details(
    chat_id: int, chat_data: ChatUpdate, db: Prisma = Depends(get_db)
):
    service = ChatService(db)
    update_dict = chat_data.model_dump(exclude_unset=True)
    if not update_dict:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No update data provided")

    # Validate foreign keys if provided
    if "llm_provider_id" in update_dict:
        llm_service = LLMProviderService(db)
        if not await llm_service.get(update_dict["llm_provider_id"]):
            raise HTTPException(status_code=404, detail=f"LLMProvider with id {update_dict['llm_provider_id']} not found.")
        # Prisma expects {"llmProvider": {"connect": {"id": provider_id}}}
        update_dict["llmProvider"] = {"connect": {"id": update_dict.pop("llm_provider_id")}}

    if "watched_folder_id" in update_dict:
        wf_service = WatchedFolderService(db)
        if not await wf_service.get(update_dict["watched_folder_id"]):
            raise HTTPException(status_code=404, detail=f"WatchedFolder with id {update_dict['watched_folder_id']} not found.")
        update_dict["watchedFolder"] = {"connect": {"id": update_dict.pop("watched_folder_id")}}


    updated_chat = await service.update_chat(chat_id, update_dict)
    if not updated_chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found or update failed")
    # Fetch again with includes for full response
    return await service.get_chat(chat_id)


@router.delete("/{chat_id}", response_model=ChatResponse)
async def delete_chat_by_id(chat_id: int, db: Prisma = Depends(get_db)):
    service = ChatService(db)
    # Fetch before delete to return the object, or rely on Prisma's return
    chat_to_delete = await service.get_chat(chat_id)
    if not chat_to_delete:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")

    deleted_chat = await service.delete_chat(chat_id) # Prisma delete returns the deleted object
    if not deleted_chat: # Should not happen if found before, but as a safeguard
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found during deletion")
    return chat_to_delete # Return the object fetched before deletion for consistency

@router.put("/{chat_id}/select-llm-provider", response_model=ChatResponse)
async def select_llm_provider_for_chat(
    chat_id: int, request_data: SelectLLMProviderRequest, db: Prisma = Depends(get_db)
):
    service = ChatService(db)
    llm_service = LLMProviderService(db)
    if not await llm_service.get(request_data.llm_provider_id):
        raise HTTPException(status_code=404, detail=f"LLMProvider with id {request_data.llm_provider_id} not found.")

    updated_chat = await service.select_llm_provider(chat_id, request_data.llm_provider_id)
    if not updated_chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found or update failed")
    return await service.get_chat(chat_id) # Fetch with full includes

@router.put("/{chat_id}/select-watched-folder", response_model=ChatResponse)
async def select_watched_folder_for_chat(
    chat_id: int, request_data: SelectWatchedFolderRequest, db: Prisma = Depends(get_db)
):
    service = ChatService(db)
    wf_service = WatchedFolderService(db)
    if not await wf_service.get(request_data.watched_folder_id):
        raise HTTPException(status_code=404, detail=f"WatchedFolder with id {request_data.watched_folder_id} not found.")

    updated_chat = await service.select_watched_folder(chat_id, request_data.watched_folder_id)
    if not updated_chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found or update failed")
    return await service.get_chat(chat_id) # Fetch with full includes


@router.get("/{chat_id}/messages", response_model=List[MessageResponse]) # <--- CORRECTED response_model
async def get_chat_messages(chat_id: int, db: Prisma = Depends(get_db)):
    service = ChatService(db)
    chat = await service.get_chat(chat_id) # This service.get_chat() already includes messages
    if not chat:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Chat not found")
    
   
    return chat.messages