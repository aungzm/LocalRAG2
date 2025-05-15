# routes/llm_provider_routes.py
from fastapi import APIRouter, Depends, HTTPException, status
from prisma import Prisma
from typing import List

from .schemas import (
    LLMProviderCreate,
    LLMProviderUpdate,
    LLMProviderResponse,
    LLMProviderTypeEnum,
    EmbeddingTypeResponse,
)
from .dependencies import get_db
from services.llm_provider import LLMProviderService # Corrected import path

router = APIRouter()


@router.post(
    "/",
    response_model=LLMProviderResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_llm_provider(
    provider_data: LLMProviderCreate, db: Prisma = Depends(get_db)
):
    service = LLMProviderService(db)
    try:
        created_provider = await service.create(
            provider_type=provider_data.type.value, # Pass the string value of the enum
            name=provider_data.name,
            api_key=provider_data.api_key,
            api_url=provider_data.api_url,
            modelName=provider_data.model_name, # Use the Pydantic field name
            embedding_type=provider_data.embedding_type,
        )
        return created_provider
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An unexpected error occurred: {str(e)}",
        )


@router.get(
    "/embedding-types/{provider_type}", response_model=EmbeddingTypeResponse
)
async def list_embedding_types_for_provider(
    provider_type: LLMProviderTypeEnum, db: Prisma = Depends(get_db)
):
    service = LLMProviderService(db)
    # The service method list_embedding_types expects the string value
    types = await service.list_embedding_types(provider_type.value)
    if not types and provider_type.value not in service.ALLOWED_EMBEDDINGS:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Provider type '{provider_type.value}' not recognized or has no defined embedding types.",
        )
    return EmbeddingTypeResponse(
        provider_type=provider_type, embedding_types=types
    )


@router.get("/{provider_id}", response_model=LLMProviderResponse)
async def get_llm_provider(provider_id: int, db: Prisma = Depends(get_db)):
    service = LLMProviderService(db)
    provider = await service.get(provider_id)
    if not provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLMProvider not found",
        )
    return provider


@router.get("/", response_model=List[LLMProviderResponse])
async def list_llm_providers(db: Prisma = Depends(get_db)):
    service = LLMProviderService(db)
    return await service.list_all()


@router.put("/{provider_id}", response_model=LLMProviderResponse)
async def update_llm_provider(
    provider_id: int,
    provider_data: LLMProviderUpdate,
    db: Prisma = Depends(get_db),
):
    service = LLMProviderService(db)
    try:
        # Use .model_dump() with by_alias=True to get 'modelName' if alias is used for input
        # and exclude_unset=True to only include provided fields.
        update_dict = provider_data.model_dump(
            exclude_unset=True, by_alias=True
        )
        if not update_dict:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No update data provided",
            )

        updated_provider = await service.update(provider_id, **update_dict)
        if not updated_provider:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="LLMProvider not found",
            )
        return updated_provider
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error updating LLMProvider.",
        )


@router.delete("/{provider_id}", response_model=LLMProviderResponse)
async def delete_llm_provider(provider_id: int, db: Prisma = Depends(get_db)):
    service = LLMProviderService(db)
    deleted_provider = await service.delete(provider_id)
    if not deleted_provider:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="LLMProvider not found",
        )
    return deleted_provider
