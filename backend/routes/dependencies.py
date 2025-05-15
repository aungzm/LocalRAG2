# routes/dependencies.py
from prisma import Prisma
from fastapi import HTTPException

# Global Prisma client instance
# Ensure Prisma client is generated: `prisma generate`
db_client = Prisma()

async def get_db():
    if not db_client.is_connected():
        try:
            await db_client.connect()
        except Exception as e:
            raise HTTPException(status_code=503, detail=f"Database connection failed: {e}")
    return db_client

async def connect_db():
    if not db_client.is_connected():
        await db_client.connect()

async def disconnect_db():
    if db_client.is_connected():
        await db_client.disconnect()
