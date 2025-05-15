from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware # Import CORSMiddleware
from contextlib import asynccontextmanager

from routes import chat_routes, llm_provider_routes, watched_folder_routes
from routes.dependencies import connect_db, disconnect_db # db_client is not used directly here

@asynccontextmanager
async def lifespan(app: FastAPI):
    print("Connecting to database...")
    await connect_db()
    yield
    print("Disconnecting from database...")
    await disconnect_db()

app = FastAPI(title="FolderWatch RAG API", lifespan=lifespan)
origins = [
    "http://localhost",        
    "http://localhost:3000",   
    "http://localhost:5173",   
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5173",
    "http://localhost:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,  # Allows specific origins
    allow_credentials=True, # Allows cookies to be included in requests
    allow_methods=["*"],    # Allows all standard HTTP methods
    allow_headers=["*"],    # Allows all headers
)

app.include_router(chat_routes.router, prefix="/api/v1/chats", tags=["Chats"])
app.include_router(llm_provider_routes.router, prefix="/api/v1/llm-providers", tags=["LLM Providers"])
app.include_router(watched_folder_routes.router, prefix="/api/v1/watched-folders", tags=["Watched Folders"])

@app.get("/")
async def root():
    return {"message": "Welcome to FolderWatch RAG API. Docs at /docs"}

