from fastapi import APIRouter, Depends, HTTPException, status
from prisma import Prisma
from typing import List

from .schemas import (
    WatchedFolderCreate, WatchedFolderUpdate, WatchedFolderResponse,
    CheckChangesRequest, CheckChangesResponse
)
from .dependencies import get_db
from services.watched_folder import WatchedFolderService # Your existing service
import os # For path validation

router = APIRouter()

@router.post("/", response_model=WatchedFolderResponse, status_code=status.HTTP_201_CREATED)
async def create_watched_folder(
    folder_data: WatchedFolderCreate, db: Prisma = Depends(get_db)
):
    service = WatchedFolderService(db)
    # Validate folder_data.path exists before calling service
    if not os.path.isdir(folder_data.path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Folder path does not exist: {folder_data.path}")
    if not os.path.isdir(folder_data.vector_db_location):
         os.makedirs(folder_data.vector_db_location, exist_ok=True) # Create if not exists

    try:
        # Assumes WatchedFolderService.create is updated to not take chat_id
        created_folder = await service.create(
            folder_path=folder_data.path,
            vector_db_filename=folder_data.vector_db_filename,
            vector_db_location=folder_data.vector_db_location,
            name=folder_data.name,
            llm_provider_id=folder_data.llm_provider_id
        )
        return created_folder
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"An unexpected error occurred: {str(e)}")


@router.get("/{folder_id}", response_model=WatchedFolderResponse)
async def get_watched_folder(folder_id: int, db: Prisma = Depends(get_db)):
    service = WatchedFolderService(db)
    folder = await service.get(folder_id)
    if not folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WatchedFolder not found")
    return folder

@router.get("/", response_model=List[WatchedFolderResponse])
async def list_watched_folders(db: Prisma = Depends(get_db)):
    service = WatchedFolderService(db)
    return await service.list_all()

@router.put("/{folder_id}", response_model=WatchedFolderResponse)
async def update_watched_folder(
    folder_id: int, folder_data: WatchedFolderUpdate, db: Prisma = Depends(get_db)
):
    service = WatchedFolderService(db)
    if folder_data.path and not os.path.isdir(folder_data.path):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"New folder path does not exist: {folder_data.path}")

    try:
        updated_folder = await service.update(
            folder_id,
            new_folder_path=folder_data.path
        )
        if not updated_folder:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WatchedFolder not found")
        return updated_folder
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error updating WatchedFolder.")


@router.delete("/{folder_id}", response_model=WatchedFolderResponse)
async def delete_watched_folder(folder_id: int, db: Prisma = Depends(get_db)):
    service = WatchedFolderService(db)
    deleted_folder = await service.delete(folder_id)
    if not deleted_folder:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="WatchedFolder not found")
    return deleted_folder

@router.post("/{folder_id}/check-changes", response_model=CheckChangesResponse)
async def check_folder_changes(
    folder_id: int, request_data: CheckChangesRequest, db: Prisma = Depends(get_db)
):
    service = WatchedFolderService(db)
    try:
        # Assumes WatchedFolderService.check_changes is updated for llm_provider_id
        changes = await service.check_changes(folder_id, request_data.llm_provider_id)
        return changes
    except ValueError as e: # e.g., folder or provider not found
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        # Log error e
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Error checking folder changes.")
