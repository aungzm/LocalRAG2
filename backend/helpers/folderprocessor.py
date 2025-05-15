import os
import hashlib

class FolderProcessor:
    """
    Processes folder contents to compute hashes for files and the folder itself,
    and to detect changes compared to a previously stored state.
    """

    # Default patterns and filenames to exclude from hashing
    _EXCLUDE_PATTERNS_START = ["~$", "."]  # Temp Word files, hidden files
    _EXCLUDE_FILENAMES = [
        ".DS_Store",
        "Thumbs.db",
        "desktop.ini",
    ]  # Common system/metadata files
    _EXCLUDE_EXTENSIONS = [".tmp", ".lock"]  # Temporary or lock files

    def __init__(self):
        pass

    def _compute_file_hash(self, file_path: str) -> str | None:
        """Computes SHA256 hash for a single file, reading in chunks."""
        if not os.path.isfile(file_path):
            return None
        try:
            hasher = hashlib.sha256()
            with open(file_path, "rb") as f:
                while chunk := f.read(8192):  # Process file in 8KB chunks
                    hasher.update(chunk)
            return hasher.hexdigest()
        except Exception:
            # Optionally log error: print(f"Error hashing {file_path}: {e}")
            return None

    def _compute_folder_hash(self, file_details_list: list[dict]) -> str:
        """
        Computes a SHA256 hash for the folder based on its files' details.
        File details must include 'relative_path' and 'file_hash', sorted.
        """
        # Sort by relative_path for a consistent hashing order
        sorted_files = sorted(
            file_details_list, key=lambda x: x["relative_path"]
        )

        hasher = hashlib.sha256()
        for file_detail in sorted_files:
            hasher.update(file_detail["relative_path"].encode("utf-8"))
            hasher.update(file_detail["file_hash"].encode("utf-8"))
        return hasher.hexdigest()

    def _should_exclude(self, file_name: str, file_path: str) -> bool:
        """Checks if a file should be excluded based on predefined rules."""
        if file_name in self._EXCLUDE_FILENAMES:
            return True
        if any(
            file_name.startswith(p) for p in self._EXCLUDE_PATTERNS_START
        ):
            return True
        _, ext = os.path.splitext(file_path)
        if ext and ext.lower() in self._EXCLUDE_EXTENSIONS:
            return True
        return False

    def hash_folder_contents(self, folder_path: str) -> dict:
        """
        Hashes all relevant files in the folder and computes an overall folder hash.
        Output (dict):
            "folder_path": absolute path to the folder.
            "folder_hash": overall hash of the folder's relevant content.
            "files": list of dicts, each with "name", "relative_path", "file_hash".
        """
        if not os.path.isdir(folder_path):
            raise ValueError(f"Path is not a directory: {folder_path}")

        file_details = []
        abs_folder_path = os.path.abspath(folder_path)

        for root, _, files in os.walk(abs_folder_path):
            for file_name in files:
                absolute_file_path = os.path.join(root, file_name)

                if self._should_exclude(file_name, absolute_file_path):
                    continue

                relative_file_path = os.path.relpath(
                    absolute_file_path, abs_folder_path
                )
                # Normalize path separators for cross-platform consistency
                relative_file_path = relative_file_path.replace(os.sep, "/")

                file_hash = self._compute_file_hash(absolute_file_path)
                if file_hash:
                    file_details.append(
                        {
                            "name": file_name,
                            "relative_path": relative_file_path,
                            "file_hash": file_hash,
                        }
                    )

        folder_content_hash = self._compute_folder_hash(file_details)

        return {
            "folder_path": abs_folder_path,
            "folder_hash": folder_content_hash,
            "files": file_details,
        }

    def check_folder_changes(
        self, folder_path: str, stored_folder_data: dict
    ) -> dict:
        """
        Compares current folder state with previously stored data.
        'stored_folder_data' (dict from DB):
            "folder_hash": Stored WatchedFolder.folderHash.
            "files": List of File records (dicts with "name", "relative_path", "file_hash").
        Output (dict):
            "folder_hash_changed": bool.
            "current_folder_hash": new folder hash.
            "current_files_state": list of all current files' info (for DB update).
            "added": list of new files' info.
            "removed": list of removed files' info.
            "modified": list of modified files' info (incl. old and new hash).
        """
        current_folder_state = self.hash_folder_contents(folder_path)

        changes = {
            "folder_hash_changed": current_folder_state["folder_hash"]
            != stored_folder_data.get("folder_hash"),
            "current_folder_hash": current_folder_state["folder_hash"],
            "current_files_state": current_folder_state[
                "files"
            ],  # Full current state
            "added": [],
            "removed": [],
            "modified": [],
        }

        stored_files_list = stored_folder_data.get("files", [])
        if not isinstance(stored_files_list, list):
            stored_files_list = [] # Gracefully handle if "files" is missing/malformed

        stored_files_map = {
            f["relative_path"]: f for f in stored_files_list
        }
        current_files_map = {
            f["relative_path"]: f for f in current_folder_state["files"]
        }

        # Detect added and modified files
        for rel_path, current_file_info in current_files_map.items():
            if rel_path not in stored_files_map:
                changes["added"].append(current_file_info)
            elif (
                current_file_info["file_hash"]
                != stored_files_map[rel_path]["file_hash"]
            ):
                changes["modified"].append(
                    {
                        "name": current_file_info["name"],
                        "relative_path": rel_path,
                        "old_file_hash": stored_files_map[rel_path][
                            "file_hash"
                        ],
                        "new_file_hash": current_file_info["file_hash"],
                    }
                )

        # Detect removed files
        for rel_path, stored_file_info in stored_files_map.items():
            if rel_path not in current_files_map:
                changes["removed"].append(stored_file_info)

        return changes