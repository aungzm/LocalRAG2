![Screenshot 2025-05-15 at 15-36-33 Vite React TS](https://github.com/user-attachments/assets/03fdf0b2-a304-4d85-9ca0-2f20b6e5e5d8)
![Screenshot 2025-05-15 at 15-19-01 Vite React TS](https://github.com/user-attachments/assets/955ea56b-8209-485d-85dc-a48f9f63ddaa)
![Screenshot 2025-05-15 at 15-18-57 Vite React TS](https://github.com/user-attachments/assets/50a73ded-1ca3-4b88-8a01-ff8f85563883)
![Screenshot 2025-05-15 at 15-19-13 Vite React TS](https://github.com/user-attachments/assets/84bc6128-3f86-4228-b4c1-795b23ff2a79)
![Screenshot 2025-05-15 at 15-19-07 Vite React TS](https://github.com/user-attachments/assets/ec7e1d27-7919-4a4b-969b-4ba8fea96a7f)
# LocalRAG2

**LocalRAG2** is a Retrieval-Augmented Generation (RAG) system that monitors your local files, updates embeddings in real time, and lets you query your documents using your choice of LLMs. Built with a Vite frontend and FastAPI backend, it provides a responsive UI and efficient processing under the hood.

## Features

* **Retrieval-Augmented Generation with a Twist**
  Combines real-time file tracking with powerful language models to query your own data.

* **Watch Folder Support**
  Specify a local folder to monitor. Files added or removed are automatically reflected in the vector database.

* **Auto-Sync Embeddings**
  Keeps your vector store up to date as files are added or removed.

* **Pluggable Embedding Providers**
  Choose from:

  * Ollama
  * OpenAI
  * Claude

* **Flexible LLM Support**
  Ask questions using:

  * Ollama
  * OpenAI
  * Claude

> **Note:** If using Ollama for embeddings or models, make sure the models are downloaded and available in your local Ollama server.

---

## Project Structure

```
localRAG2/
├── backend/       # FastAPI + Uvicorn backend
├── frontend/      # Vite + React frontend
```

---

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/localRAG2.git
cd localRAG2
```

### 2. Backend Setup (FastAPI)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload
```

### 3. Frontend Setup (Vite)

```bash
cd frontend
npm install
npm run dev
```

The frontend will run on `http://localhost:5173`, while the backend runs on `http://localhost:8000`.

---

## Notes

* Ollama users must have the relevant models downloaded and running locally (`ollama run <model>`).
* Your watch folder will be monitored automatically, and the backend will update the vector database as needed.

---

## License

[MIT License](LICENSE)



