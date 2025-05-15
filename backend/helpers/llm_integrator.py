import chromadb
import ollama
from typing import List, Optional
import logging
from openai import OpenAI
from langchain_openai import OpenAIEmbeddings
from langchain_community.embeddings import OllamaEmbeddings
from typing import Any, Optional
from prisma.models import LLMProvider # type: ignore
logger = logging.getLogger(__name__)
import os
from dotenv import load_dotenv
load_dotenv()
VECTOR_DB_COLLECTION_NAME = os.getenv("VECTOR_DB_COLLECTION_NAME")

PROMPT_TEMPLATE = (
    "You are a helpful assistant. Answer the user's question appropriately.\n\n"
    "Question: {question}\n\n"
    "Note: Use the context provided below ONLY if it is relevant. Otherwise, respond "
    "based on your general knowledge.\n\n"
    "Context:\n{context}\n"
)

NEED_CONTEXT = (
    "You are a helpful assistant. Analyze the user's question and respond with either "
    "\"True\" or \"False\" on whether you need more context to answer the question.\n\n"
    "Question: {question}\n"
)

def select_embeddings(provider: LLMProvider) -> Any: # Returns a Langchain Embeddings object
    """
    Selects and initializes the Langchain embedding object based on the provider.
    This object can be used by Langchain components (like Chroma vector store)
    and has methods like .embed_query() and .embed_documents().
    """
    provider_type_val = provider.type # Assumes type is stored as string e.g., "OpenAi", "Ollama"
    embedding_model = provider.embeddingType

    logger.info(
        f"Initializing Langchain embeddings for provider: {provider_type_val}, model: {embedding_model}"
    )

    if provider_type_val == "OpenAi":
        if not provider.apiKey:
            raise ValueError(
                "OpenAI API key is required for Langchain's OpenAIEmbeddings."
            )
        try:
            # Use Langchain's wrapper for OpenAI embeddings
            return OpenAIEmbeddings(
                model=embedding_model, openai_api_key=provider.apiKey
            )
        except ImportError:
            logger.error("langchain_openai package not found. Please install it.")
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Langchain OpenAIEmbeddings: {e}")
            raise

    elif provider_type_val == "Ollama":
        # Ollama base URL might be needed if not default localhost
        base_url = provider.apiUrl if provider.apiUrl else "http://localhost:11434"
        try:
            # Use Langchain's wrapper for Ollama embeddings
            return OllamaEmbeddings(model=embedding_model, base_url=base_url)
        except ImportError:
            logger.error(
                "langchain_community package not found. Please install it."
            )
            raise
        except Exception as e:
            logger.error(f"Failed to initialize Langchain OllamaEmbeddings: {e}")
            raise
        
    # elif provider_type_val == "Gemini":
    #     if not provider.apiKey: # Assuming Gemini uses an API key
    #         raise ValueError("Gemini API key is required for GoogleGenerativeAIEmbeddings.")
    #     try:
    #         from langchain_google_genai import GoogleGenerativeAIEmbeddings
    #         return GoogleGenerativeAIEmbeddings(model=embedding_model, google_api_key=provider.apiKey)
    #     except ImportError:
    #         logger.error("langchain_google_genai package not found. Please install it.")
    #         raise
    #     except Exception as e:
    #         logger.error(f"Failed to initialize Langchain GoogleGenerativeAIEmbeddings: {e}")
    #         raise

    else:
        raise ValueError(
            f"Unsupported provider type for Langchain embeddings: {provider_type_val}"
        )

def generate_embedding(
    embedding_provider: str, embedding_model: str, input_text: str, 
    api_key: Optional[str] = None
) -> List[float]:
    """
    Generates a vector embedding for the given text using the specified model.
    For Ollama, sends a REST request to the local embed API.  
    For OpenAI, uses OpenAI's Embedding endpoint.
    """
    if embedding_provider.lower() == "ollama":
        response = ollama.embed(
            model=embedding_model,
            input=input_text,
        )
        return response.get("embedding", [])
    elif embedding_provider.lower() == "openai":
        if not api_key:
            raise ValueError("OpenAI API key is required for OpenAI embeddings.")
        client = OpenAI(api_key=api_key)
        response = client.embeddings.create(model=embedding_model, input=input_text)
        return response.data[0].embedding
    else:
        raise ValueError(f"Unknown embedding provider: {embedding_provider}")

def call_llm(
    llm_provider: str, model: str, prompt: str, 
    api_key: Optional[str] = None
) -> str:
    """
    Calls an LLM using the given prompt and returns its output.
    For Ollama, uses its REST API (e.g. /api/chat).  
    For OpenAI, uses the ChatCompletion endpoint.
    """
    if llm_provider.lower() == "ollama":
        response = ollama.chat(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
        )
        return response.get("message", {}).get("content", "")
    elif llm_provider.lower() == "openai":
        if not api_key:
            raise ValueError("OpenAI API key is required for OpenAI LLM.")
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=model,
            messages=[{"role": "user", "content": prompt}],
            stream=False,
        )
        return response.choices[0].message.content.strip()
    else:
        raise ValueError(f"Unknown LLM provider: {llm_provider}")

def query_rag(
    query_text: str,
    vector_store_persist_dir: str, 
    embedding_provider_details: LLMProvider, 
    llm_provider_details: LLMProvider,       
    llm_model: str,                          
    n_results: int = 5,
) -> str:
    """
    Performs Retrieval-Augmented Generation (RAG).
    """
    llm_provider_type = llm_provider_details.type.lower()
    llm_api_key = llm_provider_details.apiKey if llm_provider_type == "openai" else None

    # Decide if context is needed
    need_context_prompt = NEED_CONTEXT.format(question=query_text)
    need_context_response = call_llm(
        llm_provider_type, llm_model, need_context_prompt, llm_api_key
    )
    needs_context = "true" in need_context_response.lower()

    context_text = "No relevant context was retrieved or needed."
    if needs_context:
        logger.info(f"Retrieving context for query from: {vector_store_persist_dir}")
        try:
            # Generate query embedding using the specified embedding provider
            embedding_function = select_embeddings(embedding_provider_details)
            query_embedding = embedding_function.embed_query(query_text)

            # Use PersistentClient for a specified directory
            client = chromadb.PersistentClient(path=vector_store_persist_dir)
            try:
                collection = client.get_collection(name=VECTOR_DB_COLLECTION_NAME)
            except Exception as e: # Catch specific exception if possible (e.g., collection not found)
                logger.warning(f"Collection '{VECTOR_DB_COLLECTION_NAME}' not found in '{vector_store_persist_dir}'. Error: {e}")
                context_text = "No relevant context found in the vector store (collection not found or empty)."
            else:
                results = collection.query(
                    query_embeddings=[query_embedding], # Note: query_embeddings (plural)
                    n_results=n_results,
                    include=["documents", "metadatas", "distances"]
                )

                if results and results.get("documents") and results["documents"][0]:
                    doc_list = results["documents"][0]
                    meta_list = results["metadatas"][0]
                    distance_list = results["distances"][0]
                    context_parts = []
                    for doc, meta, dist in zip(doc_list, meta_list, distance_list):
                        source_info = meta.get("source", "Unknown Source")
                        page_info = meta.get("page", "N/A")
                        context_parts.append(
                            f"Source: {os.path.basename(source_info)} (Page: {page_info}, Distance: {dist:.4f})\n{doc}"
                        )
                    context_text = "\n\n---\n\n".join(context_parts)
                    logger.info(f"Retrieved {len(doc_list)} context chunks.")
                else:
                    context_text = "No relevant documents found in the vector store for this query."
                    logger.info("No relevant documents found during Chroma query.")

        except Exception as e:
            logger.error(f"Error during RAG context retrieval: {e}")
            context_text = "An error occurred while retrieving context."

    final_prompt = PROMPT_TEMPLATE.format(question=query_text, context=context_text)
    logger.info("Generating final response with LLM...")
    response_text = call_llm(
        llm_provider_type, llm_model, final_prompt, llm_api_key
    )
    return response_text