import os
import shutil
import logging
from typing import List, Any

from langchain_community.document_loaders import (
    PyPDFLoader,
    Docx2txtLoader,
    TextLoader,
    UnstructuredPowerPointLoader,
)
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document
from langchain_chroma import Chroma
from prisma.models import LLMProvider 
from . import llm_integrator
import os
from dotenv import load_dotenv

load_dotenv()
VECTOR_DB_COLLECTION_NAME = os.getenv("VECTOR_DB_COLLECTION_NAME")

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_document(file_path: str) -> List[Document] | None:
    try:
        file_extension = os.path.splitext(file_path)[1].lower()
        loader: Any = None

        if file_extension in [".txt", ".md"]:
            loader = TextLoader(file_path, encoding="utf-8")
        elif file_extension == ".docx":
            loader = Docx2txtLoader(file_path)
        elif file_extension == ".pptx":
            loader = UnstructuredPowerPointLoader(file_path)
        elif file_extension == ".pdf":
            loader = PyPDFLoader(file_path)
        else:
            logger.warning(f"Unsupported file type skipped: {file_path}")
            return None

        return loader.load()

    except Exception as e:
        logger.error(f"Error loading document {file_path}: {e}")
        return None


def split_documents(documents: List[Document]) -> List[Document]:
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=800,
        chunk_overlap=80,
        length_function=len,
        is_separator_regex=False,
    )
    return text_splitter.split_documents(documents)


def calculate_chunk_ids(chunks: List[Document]) -> List[Document]:
    last_page_id = None
    current_chunk_index = 0

    for chunk in chunks:
        source = chunk.metadata.get("source")
        if not source or not os.path.isabs(source):
            logger.warning(f"Chunk source missing or not absolute: {chunk.metadata}")
            # Fallback ID generation if source is unreliable
            source = f"unknown_source_{hash(chunk.page_content)}"

        page = chunk.metadata.get("page", 0)
        current_page_id = f"{source}:{page}"

        if current_page_id == last_page_id:
            current_chunk_index += 1
        else:
            current_chunk_index = 0
            last_page_id = current_page_id

        chunk.metadata["id"] = f"{current_page_id}:{current_chunk_index}"

    return chunks


def _get_chroma_db(
    persist_directory: str, provider: LLMProvider
) -> Chroma:
    """Initializes and returns a Chroma DB instance for a specific directory."""
    embedding_function = llm_integrator.select_embeddings(provider)
    db = Chroma(
        collection_name=VECTOR_DB_COLLECTION_NAME,
        persist_directory=persist_directory,
        embedding_function=embedding_function,
    )
    return db


def _remove_chunks_by_source(db: Chroma, source_path: str):
    """Removes all chunks associated with a specific source file path."""
    try:
        normalized_source_path = os.path.abspath(source_path).replace(os.sep, "/")

        # Use Chroma's filtering capability
        existing_items = db.get(
            where={"source": normalized_source_path},
            include=["metadatas"] # include metadatas just for logging count
        )

        ids_to_remove = existing_items.get("ids")

        if ids_to_remove:
            logger.info(
                f"Removing {len(ids_to_remove)} chunks for source: {normalized_source_path}"
            )
            db.delete(ids=ids_to_remove)
        else:
            logger.info(f"No chunks found to remove for source: {normalized_source_path}")

    except Exception as e:
        logger.error(f"Error removing chunks for source {source_path}: {e}")


def _add_chunks(db: Chroma, chunks_with_ids: List[Document]):
    if not chunks_with_ids:
        logger.info("No chunks provided to add.")
        return
    try:
        chunk_ids = [chunk.metadata["id"] for chunk in chunks_with_ids]
        logger.info(f"Attempting to add {len(chunks_with_ids)} chunks with IDs: {chunk_ids[:5]}...") # Log first few IDs
        db.add_documents(documents=chunks_with_ids, ids=chunk_ids)
        logger.info(f"Successfully added {len(chunks_with_ids)} chunks to collection '{db._collection.name}' in '{db._persist_directory}'.")
    except Exception as e:
        logger.error(f"Error adding chunks to Chroma: {e}", exc_info=True) # Add exc_info
        raise #


def process_file_for_vector_db(
    file_path: str,
    persist_directory: str,
    provider: LLMProvider,
    action: str,
):
    """
    Processes a single file for addition, modification, or removal in Chroma.
    """
    logger.info(
        f"Processing file: {file_path} (Action: {action}) in DB: {persist_directory}"
    )
    # Ensure the persist directory exists, especially for 'add'/'modify'
    os.makedirs(persist_directory, exist_ok=True)
    db = _get_chroma_db(persist_directory, provider)

    if action == "remove":
        _remove_chunks_by_source(db, file_path)
    elif action in ["add", "modify"]:
        if action == "modify":
            _remove_chunks_by_source(db, file_path)

        documents = load_document(file_path)
        if documents:
            chunks = split_documents(documents)
            chunks_with_ids = calculate_chunk_ids(chunks)
            _add_chunks(db, chunks_with_ids)
        else:
            logger.warning(f"Skipping add/modify for {file_path} due to loading error.")
    else:
        logger.error(f"Unknown action '{action}' for file {file_path}")


def clear_vector_database(persist_directory: str):
    """Removes the entire Chroma database directory."""
    if os.path.exists(persist_directory):
        try:
            shutil.rmtree(persist_directory)
            logger.info(f"Successfully cleared Chroma database at: {persist_directory}")
        except Exception as e:
            logger.error(f"Error clearing Chroma database at {persist_directory}: {e}")
    else:
        logger.info(f"Chroma database path not found, nothing to clear: {persist_directory}")

