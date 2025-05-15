"use client";

import { useState, useEffect, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select"; // Added Select
import { FolderOpen } from "lucide-react";
import {
  type ApiWatchedFolderResponse,
  type WatchedFolderCreatePayload,
  type WatchedFolderUpdatePayload,
  type ApiLLMProviderResponse, // Added LLMProvider type
} from "../../types";

interface WatchedFolderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: WatchedFolderCreatePayload | WatchedFolderUpdatePayload,
    id?: number,
  ) => Promise<void>;
  initialData?: ApiWatchedFolderResponse | null;
  llmProviders: ApiLLMProviderResponse[]; // Added: To populate the LLM provider dropdown
}

export function WatchedFolderFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  llmProviders, // Destructure new prop
}: WatchedFolderFormDialogProps) {
  const isEditMode = !!initialData;

  const [name, setName] = useState(""); // New state for folder name
  const [path, setPath] = useState("");
  const [selectedLlmProviderId, setSelectedLlmProviderId] = useState<
    string | undefined
  >(undefined); // New state for LLM Provider ID
  const [vectorDbFilename, setVectorDbFilename] = useState("");
  const [vectorDbLocation, setVectorDbLocation] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isEditMode && initialData) {
      setName(initialData.name || ""); // Initialize name
      setPath(initialData.path);
      setSelectedLlmProviderId(initialData.llmProviderId?.toString() || ""); // Initialize LLM Provider
      setVectorDbFilename(initialData.vectorDbFilename);
      setVectorDbLocation(initialData.vectorDbLocation);
    } else {
      setName(""); // Reset name
      setPath("");
      setSelectedLlmProviderId(undefined); // Reset LLM Provider
      setVectorDbFilename("");
      setVectorDbLocation(""); // Or a sensible default like "./.vector_dbs"
    }
    setError("");
  }, [open, initialData, isEditMode]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Folder display name is required");
      return;
    }
    if (!path.trim()) {
      setError("Folder path is required");
      return;
    }
    if (!selectedLlmProviderId) {
      setError("An LLM Provider must be selected for embeddings");
      return;
    }
    if (!vectorDbLocation.trim() && !isEditMode) {
      // Only required for new, for edit it's read-only
      setError("Vector DB Storage Location is required");
      return;
    }

    const finalVectorDbFilename =
      vectorDbFilename.trim() ||
      `${(path.split(/\/|\\/).pop() || "default_folder")
        .toLowerCase()
        .replace(/\s+/g, "_")}_${Date.now()}_vectors`; // Added timestamp for more uniqueness

    let payload: WatchedFolderCreatePayload | WatchedFolderUpdatePayload;

    if (isEditMode && initialData) {
      const updatePayload: WatchedFolderUpdatePayload = {};
      if (name !== initialData.name) updatePayload.name = name;
      if (path !== initialData.path) updatePayload.path = path;
      if (
        selectedLlmProviderId &&
        parseInt(selectedLlmProviderId) !== initialData.llmProviderId
      ) {
        updatePayload.llmProviderId = parseInt(selectedLlmProviderId);
      }
      // vectorDbFilename and vectorDbLocation are not typically updated.
      // If you need to update them, add logic here.

      if (Object.keys(updatePayload).length === 0) {
        setError("No changes detected.");
        return;
      }
      payload = updatePayload;
    } else {
      // Create mode
      payload = {
        name: name.trim(),
        path: path.trim(),
        llmProviderId: parseInt(selectedLlmProviderId as string),
        vectorDbFilename: finalVectorDbFilename,
        vectorDbLocation: vectorDbLocation.trim(),
      };
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload, isEditMode ? initialData?.id : undefined);
      // Dialog closing is handled by onOpenChange via parent
    } catch (apiError) {
      setError(
        apiError instanceof Error
          ? apiError.message
          : `Failed to ${isEditMode ? "update" : "add"} folder.`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    onOpenChange(false);
  };

  const handleDirectoryPicker = async () => {
      alert(
        "Directory picker API is not supported in your browser. Please type the path manually.",
      );
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {isEditMode ? "Edit" : "Add"} Watched Folder
            </DialogTitle>
            <DialogDescription>
              {isEditMode
                ? "Update the configuration for this"
                : "Select a folder to watch and index for"}{" "}
              searching with AI.
              {isEditMode && initialData && (
                <span className="font-semibold"> ({initialData.name})</span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="folder-form-name">Display Name</Label>
              <Input
                id="folder-form-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="My Project Documents"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="folder-form-path">Folder Path</Label>
              <div className="flex gap-2">
                <Input
                  id="folder-form-path"
                  value={path}
                  onChange={(e) => setPath(e.target.value)}
                  placeholder="/path/to/your/documents"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={handleDirectoryPicker}
                  aria-label="Select folder"
                >
                  <FolderOpen className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="folder-form-llm-provider">
                LLM Provider (for Embeddings)
              </Label>
              <Select
                value={selectedLlmProviderId}
                onValueChange={setSelectedLlmProviderId}
              >
                <SelectTrigger id="folder-form-llm-provider">
                  <SelectValue placeholder="Select an LLM provider" />
                </SelectTrigger>
                <SelectContent>
                  {llmProviders.length > 0 ? (
                    llmProviders.map((provider) => (
                      <SelectItem
                        key={provider.id}
                        value={provider.id.toString()}
                      >
                        {provider.name} ({provider.type} -{" "}
                        {provider.embeddingType})
                      </SelectItem>
                    ))
                  ) : (
                    <SelectItem value="disabled" disabled>
                      No LLM providers available. Please add one first.
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="folder-form-vectorDbFilename">
                Vector DB Filename{" "}
                {isEditMode ? "(Read-only)" : "(Optional)"}
              </Label>
              <Input
                id="folder-form-vectorDbFilename"
                value={vectorDbFilename}
                onChange={(e) => setVectorDbFilename(e.target.value)}
                placeholder="e.g., my_project_vectors"
                disabled={isEditMode}
              />
              {!isEditMode && (
                <p className="text-sm text-muted-foreground">
                  Leave blank to auto-generate (e.g., foldername_timestamp_vectors).
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="folder-form-vectorDbLocation">
                Vector DB Storage Location{" "}
                {isEditMode ? "(Read-only)" : ""}
              </Label>
              <Input
                id="folder-form-vectorDbLocation"
                value={vectorDbLocation}
                onChange={(e) => setVectorDbLocation(e.target.value)}
                placeholder="./data/vector_stores"
                disabled={isEditMode}
              />
              {!isEditMode && (
                <p className="text-sm text-muted-foreground">
                  Base directory where the vector DB sub-directory will be
                  created.
                </p>
              )}
            </div>

            {error && (
              <p className="text-sm font-medium text-red-500 py-2">{error}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={handleCloseDialog}
              type="button"
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || (llmProviders.length === 0 && !isEditMode) }>
              {isSubmitting
                ? isEditMode
                  ? "Updating..."
                  : "Adding..."
                : isEditMode
                  ? "Update Folder"
                  : "Add Folder"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
