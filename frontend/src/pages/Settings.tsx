"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { WatchedFolderList } from "../components/settings/watched-folder-list";
import { LLMProviderList } from "../components/settings/llm-provider-list";
import { WatchedFolderFormDialog } from "../components/settings/watched-folder-form-dialog";
import { LLMProviderFormDialog } from "../components/settings/llm-provider-form-dialog";
import { ChevronLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  type ApiWatchedFolderResponse,
  type ApiLLMProviderResponse,
  type WatchedFolderCreatePayload,
  type LLMProviderCreatePayload,
  type WatchedFolderUpdatePayload,
  type LLMProviderUpdatePayload,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_BASE_URL || "http://localhost:8000/api";
const API_V1_URL = `${API_BASE_URL}/v1`;

export default function SettingsPage() {
  const [watchedFolders, setWatchedFolders] = useState<ApiWatchedFolderResponse[]>([]);
  const [llmProviders, setLLMProviders] = useState<ApiLLMProviderResponse[]>([]);
  const [isFolderFormOpen, setIsFolderFormOpen] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState<ApiWatchedFolderResponse | null>(null);
  const [isLLMFormOpen, setIsLLMFormOpen] = useState(false);
  const [providerToEdit, setProviderToEdit] = useState<ApiLLMProviderResponse | null>(null);
  const [isLoadingFolders, setIsLoadingFolders] = useState(true);
  const [isLoadingProviders, setIsLoadingProviders] = useState(true);
  const [error, setError] = useState<string | null>(null); // Combined error state
  const navigate = useNavigate();

  // Fetch Watched Folders
  const fetchWatchedFolders = async () => {
    setIsLoadingFolders(true);
    // setError(null); // Don't clear global error here, let specific actions set it
    try {
      const response = await fetch(`${API_V1_URL}/watched-folders`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to fetch watched folders");
      }
      const data: ApiWatchedFolderResponse[] = await response.json();
      setWatchedFolders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred fetching folders");
      setWatchedFolders([]);
    } finally {
      setIsLoadingFolders(false);
    }
  };

  // Fetch LLM Providers
  const fetchLLMProviders = async () => {
    setIsLoadingProviders(true);
    // setError(null);
    try {
      const response = await fetch(`${API_V1_URL}/llm-providers`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to fetch LLM providers");
      }
      const data: ApiLLMProviderResponse[] = await response.json();
      setLLMProviders(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An unknown error occurred fetching providers");
      setLLMProviders([]);
    } finally {
      setIsLoadingProviders(false);
    }
  };

  useEffect(() => {
    fetchWatchedFolders();
    fetchLLMProviders();
  }, []);

  // Watched Folder Handlers
  const handleOpenFolderForm = (folder?: ApiWatchedFolderResponse | null) => {
    setFolderToEdit(folder || null);
    setIsFolderFormOpen(true);
    setError(null); // Clear error when opening form
  };

  const handleOpenLLMForm = (provider?: ApiLLMProviderResponse | null) => {
    setProviderToEdit(provider || null);
    setIsLLMFormOpen(true);
    setError(null); // Clear error when opening form
  };

  const handleFolderFormSubmit = async (
    data: WatchedFolderCreatePayload | WatchedFolderUpdatePayload,
    id?: number,
  ) => {
    setError(null);
    const isEdit = !!id;
    const endpoint = isEdit ? `${API_V1_URL}/watched-folders/${id}` : `${API_V1_URL}/watched-folders`;
    const method = isEdit ? "PUT" : "POST";

    try {
      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Failed to ${isEdit ? 'update' : 'add'} watched folder`);
      }
      await fetchWatchedFolders(); // Refresh list
      setIsFolderFormOpen(false);
      setFolderToEdit(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : `Could not ${isEdit ? 'update' : 'add'} folder.`;
      setError(message); // Error will be set by the dialog itself
      throw err; // Re-throw for dialog to catch and display
    }
  };

  const handleLLMFormSubmit = async (
    data: LLMProviderCreatePayload | LLMProviderUpdatePayload,
    id?: number,
  ) => {
    setError(null);
    const isEdit = !!id;
    const endpoint = isEdit ? `${API_V1_URL}/llm-providers/${id}` : `${API_V1_URL}/llm-providers`;
    const method = isEdit ? "PUT" : "POST";

      const response = await fetch(endpoint, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Failed to ${isEdit ? 'update' : 'add'} LLM provider`);
      }
      await fetchLLMProviders(); // Refresh list
      setIsLLMFormOpen(false);
      setProviderToEdit(null);
  };

  const handleDeleteWatchedFolder = async (id: number) => {
    setError(null);
    try {
      const response = await fetch(`${API_V1_URL}/watched-folders/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete watched folder");
      }
      await fetchWatchedFolders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete folder.");
    }
  };

  const handleDeleteLLMProvider = async (id: number) => {
    setError(null);
    try {
      const response = await fetch(`${API_V1_URL}/llm-providers/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Failed to delete LLM provider");
      }
      await fetchLLMProviders();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete provider.");
    }
  };

  return (
    <div className="ml-8 mr-8 py-10">
      <div className="flex items-center">
        <ChevronLeft className="mt-1 h-6 w-6 cursor-pointer mr-2 mb-4"
        onClick={() => navigate("/")}
        aria-label="Go back"
        />
        <h1 className="text-2xl font-bold mb-4">Settings</h1>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 border border-red-300 rounded-md">
          <p>Error: {error}</p>
        </div>
      )}

      <Tabs defaultValue="folders" className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="folders">Watched Folders</TabsTrigger>
          <TabsTrigger value="llm">LLM Providers</TabsTrigger>
        </TabsList>

        <TabsContent value="folders">
          <Card>
            <CardHeader>
              <CardTitle>Watched Folders</CardTitle>
              <CardDescription>Manage folders being watched and their embedding configurations.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingFolders ? <p>Loading folders...</p> : (
                <WatchedFolderList
                  folders={watchedFolders}
                  onDelete={handleDeleteWatchedFolder}
                  onEdit={(folder) => handleOpenFolderForm(folder)}
                  llmProviders={llmProviders} // Pass LLM Providers for context in the list
                />
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleOpenFolderForm()} disabled={llmProviders.length === 0}>
                Add Folder
              </Button>
              {llmProviders.length === 0 && (
                <p className="ml-4 text-sm text-muted-foreground">
                  Please add an LLM Provider before adding a watched folder.
                </p>
              )}
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="llm">
          <Card>
            <CardHeader>
              <CardTitle>LLM Providers</CardTitle>
              <CardDescription>Configure LLM providers for chat and embedding.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingProviders ? <p>Loading LLM providers...</p> : (
                <LLMProviderList
                  providers={llmProviders}
                  onDelete={handleDeleteLLMProvider}
                  onEdit={(provider) => handleOpenLLMForm(provider)}
                />
              )}
            </CardContent>
            <CardFooter>
              <Button onClick={() => handleOpenLLMForm()}>Add Provider</Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>

      <WatchedFolderFormDialog
        open={isFolderFormOpen}
        onOpenChange={setIsFolderFormOpen}
        onSubmit={handleFolderFormSubmit}
        initialData={folderToEdit}
        llmProviders={llmProviders} 
      />

      <LLMProviderFormDialog
        open={isLLMFormOpen}
        onOpenChange={setIsLLMFormOpen}
        onSubmit={handleLLMFormSubmit}
        initialData={providerToEdit}
      />
    </div>
  );
}
