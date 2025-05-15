import os
import sqlite3
import random
from datetime import datetime, timezone
import dotenv

# Load environment variables from .env
dotenv.load_dotenv()

def get_current_timestamp():
    return datetime.now(timezone.utc).isoformat()

def main():
    # Get the DATABASE_URL from the environment
    database_url = os.getenv("DATABASE_URL", "file:./prisma/database.db")

    # Remove "file:" prefix and resolve path relative to the schema location
    if database_url.startswith("file:"):
        db_relative_path = database_url.replace("file:", "", 1)
    else:
        raise ValueError("DATABASE_URL must start with 'file:' for SQLite")

    # Resolve full path relative to the prisma/ directory
    db_path = os.path.abspath(os.path.join(os.path.dirname(__file__), db_relative_path))

    print("Working directory:", os.getcwd())
    print("Resolved database path:", db_path)

    try:
        conn = sqlite3.connect(db_path)
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute("PRAGMA foreign_keys = ON;")

        now = get_current_timestamp()

        # Insert LLMProvider
        cursor.execute(
            """
            INSERT INTO "LLMProvider" (type, name, apiKey, apiUrl, embeddingType, modelName, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            ("OpenAI", "OpenAI Provider", "openai-key-123", "https://api.openai.com", "text", "gpt-4", now, now)
        )
        llm_provider_id = cursor.lastrowid

        # Insert WatchedFolder
        cursor.execute(
            """
            INSERT INTO "WatchedFolder" (path, vectorDbFilename, vectorDbLocation, folderHash, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            ("/data/watched/folder", "vector.db", "/data/vector", "folderhash-123", now, now)
        )
        watched_folder_id = cursor.lastrowid

        # Insert Files
        files = [
            ("file1.txt", "docs/file1.txt", "filehash-abc"),
            ("file2.txt", "docs/file2.txt", "filehash-def")
        ]
        for name, path, hash_ in files:
            cursor.execute(
                """
                INSERT INTO "File" (name, relativePath, fileHash, watchedFolderId, createdAt, updatedAt)
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (name, path, hash_, watched_folder_id, now, now)
            )

        # Insert Chat
        cursor.execute(
            """
            INSERT INTO "Chat" (name, watchedFolderId, llmProviderId, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("Test Chat 1", watched_folder_id, llm_provider_id, now, now)
        )
        chat_id = cursor.lastrowid

        # Insert Messages
        messages = [
            ("Hello, this is a test message.", "User"),
            ("Hello, this is a test response.", "Assistant")
        ]
        for text, sender in messages:
            cursor.execute(
                """
                INSERT INTO "Message" (text, sender, chatId, createdAt)
                VALUES (?, ?, ?, ?)
                """,
                (text, sender, chat_id, now)
            )

        conn.commit()
        print("✅ Mock data seeded successfully.")

    except Exception as e:
        print("❌ An error occurred while seeding the database:")
        print(e)
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    main()
