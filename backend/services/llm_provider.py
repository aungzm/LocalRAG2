from typing import List, Optional, Any
from prisma.models import LLMProvider
from prisma import Prisma

class LLMProviderService:
    """
    Service class to perform CRUD operations on LLMProvider records,
    ensuring that the embedding type matches the provider type.
    """

    ALLOWED_EMBEDDINGS = {
        "OpenAI": [
            "text-embedding-3-small",
            "text-embedding-3-large",
            "text-embedding-ada-002",
        ],
        "Ollama": [
            "nomic-embed-text",
            "mxbai-embed-large",
            "bge-m3",
            "snowflake-arctic-embed",
            "all-minilm",
            "bge-large",
            "snowflake-arctic-embed2",
            "paraphrase-multilingual",
            "granite-embedding",
        ],
        "Claude": [
            "voyage-3-large",
            "voyage-3",
            "voyage-3-lite",
            "voyage-code-3",
            "voyage-finance-2",
            "voyage-law-2",
        ],

        "Gemini": [
            "gemini-embedding-exp-03-07",
            "text-embedding-004",
            "embedding-001",
        ],
    }

    def __init__(self, db_client: Prisma) -> None:
        self.db = db_client

    async def create(
        self,
        provider_type: str,
        name: str,
        api_key: str,
        api_url: str,
        modelName: str,
        embedding_type: str,
    ) -> LLMProvider:
        """
        Create a new LLMProvider record.

        Validates that the provided `embedding_type` is in the allowed list
        corresponding to `provider_type`.
        """
        if embedding_type not in self.ALLOWED_EMBEDDINGS.get(provider_type, []):
            raise ValueError(
                f"Invalid embedding type '{embedding_type}' for provider type "
                f"{provider_type}. Allowed embedding types are: "
                f"{self.ALLOWED_EMBEDDINGS.get(provider_type)}"
            )

        new_provider = await self.db.llmprovider.create(
            data={
                "type": provider_type,
                "name": name,
                "apiKey": api_key,
                "apiUrl": api_url,
                "modelName": modelName,
                "embeddingType": embedding_type,
            }
        )
        return new_provider
    
    async def list_embedding_types(self, provider_type: str) -> List[str]:
        """
        List all allowed embedding types for a given provider type.
        """
        return self.ALLOWED_EMBEDDINGS.get(provider_type, [])

    async def get(self, provider_id: int) -> Optional[LLMProvider]:
        """
        Retrieve a single LLMProvider by its ID.
        """
        return await self.db.llmprovider.find_unique(
            where={"id": provider_id}
        )

    async def update(
        self, provider_id: int, **update_data: Any
    ) -> Optional[LLMProvider]:
        """
        Update an existing LLMProvider record with provided fields.

        If the update includes changes to the provider type or the embedding type,
        this method validates that the resulting embedding type is allowed
        for the (new) provider type.
        """
        # Retrieve current provider
        current_provider = await self.get(provider_id)
        if not current_provider:
            return None

        # Determine the effective provider type and embedding type after update.
        current_type = current_provider.type
        current_embedding = current_provider.embeddingType

        effective_type = update_data.get("type", current_type)
        effective_embedding = update_data.get("embeddingType", current_embedding)

        if effective_embedding not in self.ALLOWED_EMBEDDINGS.get(effective_type, []):
            raise ValueError(
                f"Invalid embedding type '{effective_embedding}' for provider type "
                f"{effective_type}. Allowed embedding types are: "
                f"{self.ALLOWED_EMBEDDINGS.get(effective_type)}"
            )

        try:
            updated_provider = await self.db.llmprovider.update(
                where={"id": provider_id}, data=update_data
            )
            return updated_provider
        except Exception as e:
            print(f"Error updating LLMProvider: {e}")
            return None

    async def delete(self, provider_id: int) -> Optional[LLMProvider]:
        """
        Delete an LLMProvider by its ID.
        """
        try:
            deleted_provider = await self.db.llmprovider.delete(
                where={"id": provider_id}
            )
            return deleted_provider
        except Exception as e:
            print(f"Error deleting LLMProvider: {e}")
            return None

    async def list_all(self) -> List[LLMProvider]:
        """
        Retrieve all LLMProvider records.
        """
        return await self.db.llmprovider.find_many()