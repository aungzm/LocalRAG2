# services/watched_folder.py
import os
import logging
from typing import Optional, List
from prisma import Prisma
from prisma.models import WatchedFolder, LLMProvider # Ensure LLMProvider is imported
from helpers.folderprocessor import FolderProcessor
from helpers.vector_db import clear_vector_database, process_file_for_vector_db
from dotenv import load_dotenv

load_dotenv()
VECTOR_DB_COLLECTION_NAME = os.getenv("VECTOR_DB_COLLECTION_NAME")
logger = logging.getLogger(__name__)

class WatchedFolderService:
    def __init__(self, db_client: Prisma) -> None:
        self.db = db_client
        self.processor = FolderProcessor()

    async def create(
        self,
        name: str,
        folder_path: str,
        vector_db_filename: str,
        vector_db_location: str,
        llm_provider_id: int, 
    ) -> WatchedFolder:
        abs_folder_path = os.path.abspath(folder_path)
        if not os.path.isdir(abs_folder_path):
            raise ValueError(f"Provided folder path does not exist: {abs_folder_path}")

        folder_data = self.processor.hash_folder_contents(abs_folder_path)
        folder_hash = folder_data["folder_hash"]
        files_data = folder_data["files"]

        created_watched_folder_stub = await self.db.watchedfolder.create(
            data={
                "name": name, 
                "path": abs_folder_path,
                "vectorDbFilename": vector_db_filename,
                "vectorDbLocation": vector_db_location,
                "folderHash": folder_hash,
                "llmProviderId": llm_provider_id
            }
        )

        if files_data:
            for file_info in files_data:
                await self.db.file.create(
                    data={
                        "name": file_info["name"],
                        "relativePath": file_info["relative_path"],
                        "fileHash": file_info["file_hash"],
                        "watchedFolderId": created_watched_folder_stub.id,
                    }
                )
        
        logger.info(f"Starting initial vector DB population for folder: {abs_folder_path}")
        unique_persist_dir = os.path.join(
            created_watched_folder_stub.vectorDbLocation,
            created_watched_folder_stub.vectorDbFilename
        )
        if not os.path.exists(unique_persist_dir):
            os.makedirs(unique_persist_dir, exist_ok=True)
            logger.info(f"Created ChromaDB directory: {unique_persist_dir}")
        
        llm_provider = await self.db.llmprovider.find_unique(
            where={"id": llm_provider_id})

        if files_data:
            for file_info in files_data:
                file_abs_path = os.path.join(abs_folder_path, file_info["relative_path"])
                logger.info(f"Processing initial file for vector DB: {file_abs_path}")
                try:
                    process_file_for_vector_db(
                        file_path=file_abs_path,
                        persist_directory=unique_persist_dir,
                        provider=llm_provider, 
                        action="add"
                    )
                except Exception as e:
                    logger.error(f"Error processing file {file_abs_path} for initial vector DB: {e}", exc_info=True)
                    raise Exception(f"Failed to process file {file_abs_path} for initial vector DB.") from e
        logger.info(f"Finished initial vector DB population for folder: {abs_folder_path}")

        fully_populated_watched_folder = await self.db.watchedfolder.find_unique(
            where={"id": created_watched_folder_stub.id},
            include={"files": True, "llmProvider": True} # INCLUDE llmProvider
        )
        
        if fully_populated_watched_folder is None:
            logger.error(f"Failed to re-fetch WatchedFolder with ID {created_watched_folder_stub.id}")
            raise Exception("Failed to retrieve created watched folder with files and provider.")

        return fully_populated_watched_folder

    async def get(self, folder_id: int) -> Optional[WatchedFolder]:
        folder = await self.db.watchedfolder.find_unique(
            where={"id": folder_id},
            include={"files": True, "llmProvider": True}, # INCLUDE llmProvider
        )
        return folder

    async def list_all(self) -> List[WatchedFolder]:
        folders = await self.db.watchedfolder.find_many(
            include={"files": True, "llmProvider": True} # INCLUDE llmProvider
        )
        return folders

    async def update(
        self, 
        folder_id: int, 
        new_name: Optional[str] = None, 
        new_folder_path: Optional[str] = None,
        new_llm_provider_id: Optional[int] = None 
    ) -> Optional[WatchedFolder]:
        if not await self.db.watchedfolder.find_unique(where={"id": folder_id}):
            logging.warning(f"Attempted to update non-existent WatchedFolder with ID: {folder_id}")
            return None

        update_data_for_prisma = {}

        if new_name is not None: 
            update_data_for_prisma["name"] = new_name

        if new_folder_path:
            abs_new_path = os.path.abspath(new_folder_path)
            if not os.path.isdir(abs_new_path):
                raise ValueError(f"Provided new folder path does not exist: {abs_new_path}")

            folder_data = self.processor.hash_folder_contents(abs_new_path)
            update_data_for_prisma["path"] = abs_new_path
            update_data_for_prisma["folderHash"] = folder_data["folder_hash"]
            new_files_data = folder_data["files"]

            async with self.db.tx() as transaction:
                await transaction.file.delete_many(where={"watchedFolderId": folder_id})
                if new_files_data:
                    for file_info in new_files_data:
                        await transaction.file.create(
                            data={
                                "name": file_info["name"],
                                "relativePath": file_info["relative_path"],
                                "fileHash": file_info["file_hash"],
                                "watchedFolderId": folder_id,
                            }
                        )
            logging.info(f"Refreshed file records for WatchedFolder ID: {folder_id}")
        
        if new_llm_provider_id is not None: 
            update_data_for_prisma["llmProviderId"] = new_llm_provider_id
            logging.info(f"Updated LLMProvider ID for WatchedFolder ID: {folder_id} to {new_llm_provider_id}")
            # we need to reprocess the folder with the new LLMProvider
            operational_llm_provider = await self.db.llmprovider.find_unique(where={"id": new_llm_provider_id})
            if not operational_llm_provider:
                logging.error(f"LLMProvider with id {new_llm_provider_id} not found.")
                raise ValueError(f"LLMProvider with id {new_llm_provider_id} not found.")
            unique_persist_dir = os.path.join(
                new_folder_path, folder_data["vector_db_filename"]
            )
            if not os.path.exists(unique_persist_dir):
                os.makedirs(unique_persist_dir, exist_ok=True)
                logging.info(f"Created ChromaDB directory: {unique_persist_dir}")
            for file_info in new_files_data:
                file_abs_path = os.path.join(new_folder_path, file_info["relative_path"])
                logging.info(f"Reprocessing file for vector DB: {file_abs_path}")
                try:
                    # Clear the old vector DB entries for this folder
                    clear_vector_database(unique_persist_dir)
                    # Process the file with the new LLMProvider
                    process_file_for_vector_db(
                        file_path=file_abs_path,
                        persist_directory=unique_persist_dir,
                        provider=operational_llm_provider, 
                        action="add"
                    )
                except Exception as e:
                    logging.error(f"Error processing file {file_abs_path} for vector DB: {e}", exc_info=True)
                    raise Exception(f"Failed to process file {file_abs_path} for vector DB.") from e

        if update_data_for_prisma:
            await self.db.watchedfolder.update(
                where={"id": folder_id},
                data=update_data_for_prisma,
            )
            logging.info(f"Updated WatchedFolder record for ID: {folder_id}")
        else:
            logging.info(f"No direct update data for WatchedFolder ID: {folder_id}.")

        fully_updated_folder = await self.db.watchedfolder.find_unique(
            where={"id": folder_id},
            include={"files": True, "llmProvider": True} # INCLUDE llmProvider
        )
        if fully_updated_folder is None:
            logger.error(f"Failed to re-fetch WatchedFolder with ID {folder_id} after update.")
            raise Exception(f"Could not retrieve WatchedFolder {folder_id} after update.")
            
        return fully_updated_folder

    
    async def delete(self, folder_id: int) -> Optional[WatchedFolder]:
        folder_to_return = await self.get(folder_id) # self.get() now includes llmProvider
        if not folder_to_return:
            logging.warning(f"Attempted to delete non-existent WatchedFolder with ID: {folder_id}")
            return None

        try:
            await self.db.watchedfolder.delete(where={"id": folder_id})
            logging.info(f"Successfully deleted WatchedFolder record with ID: {folder_id} from database.")
        except Exception as e:
            logging.error(f"Database error while deleting WatchedFolder with ID {folder_id}: {e}")
            return None 

        vector_db_path = os.path.join(
            folder_to_return.vectorDbLocation, folder_to_return.vectorDbFilename
        )
        if os.path.exists(vector_db_path):
            try:
                clear_vector_database(vector_db_path)
                logging.info(f"Successfully cleared vector DB artifacts at: {vector_db_path}")
            except Exception as e:
                logging.error(f"Error clearing vector DB artifacts at {vector_db_path}: {e}")
        else:
            logging.info(f"Vector DB path not found, no need to clear: {vector_db_path}")
        return folder_to_return

    async def check_changes(self, folder_id: int, llm_provider_id: int) -> dict:
        folder = await self.get(folder_id) # self.get() includes llmProvider
        if not folder:
            logging.error(f"WatchedFolder with id {folder_id} not found.")
            raise ValueError(f"WatchedFolder with id {folder_id} not found.")

        # The llm_provider for the operation is fetched based on llm_provider_id from request
        operational_llm_provider = await self.db.llmprovider.find_unique(where={"id": llm_provider_id})
        if not operational_llm_provider:
            logging.error(f"LLMProvider with id {llm_provider_id} for check_changes not found.")
            raise ValueError(f"LLMProvider with id {llm_provider_id} for check_changes not found.")

        folder_files = folder.files if folder.files is not None else []
        stored_folder_data = {
            "folder_hash": folder.folderHash,
            "files": [
                {"name": f.name, "relative_path": f.relativePath, "file_hash": f.fileHash}
                for f in folder_files
            ],
        }
        changes = self.processor.check_folder_changes(folder.path, stored_folder_data)

        if changes["folder_hash_changed"]:
            logging.info(f"Folder hash changed for WatchedFolder ID: {folder_id}. Processing.")
            unique_persist_dir = os.path.join(folder.vectorDbLocation, folder.vectorDbFilename)
            if not os.path.exists(unique_persist_dir):
                os.makedirs(unique_persist_dir, exist_ok=True)

            for file_action_type, files_to_process in [
                ("add", changes["added"]),
                ("remove", changes["removed"]),
                ("modify", changes["modified"]),
            ]:
                for file_info in files_to_process:
                    file_abs_path = os.path.join(folder.path, file_info["relative_path"])
                    logging.info(f"Processing file ({file_action_type}): {file_abs_path}")
                    process_file_for_vector_db(
                        file_path=file_abs_path,
                        persist_directory=unique_persist_dir, # Corrected param name
                        provider=operational_llm_provider,
                        action=file_action_type
                    )
            
            logging.info(f"Updating file records in DB for WatchedFolder ID: {folder_id}")
            await self.db.file.delete_many(where={"watchedFolderId": folder_id})
            for file_info in changes["current_files_state"]:
                await self.db.file.create(
                    data={
                        "name": file_info["name"],
                        "relativePath": file_info["relative_path"],
                        "fileHash": file_info["file_hash"],
                        "watchedFolderId": folder_id,
                    }
                )
            await self.db.watchedfolder.update(
                where={"id": folder_id},
                data={"folderHash": changes["current_folder_hash"]},
            )
            logging.info(f"Updated folderHash for WatchedFolder ID: {folder_id}")
        else:
            logging.info(f"No changes detected for WatchedFolder ID: {folder_id}.")
        return changes

