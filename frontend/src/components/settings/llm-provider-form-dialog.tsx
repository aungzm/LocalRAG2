"use client";

import { useState, useEffect, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import {
  LLMProviderTypeEnum,
  type ApiLLMProviderResponse,
  type LLMProviderCreatePayload,
  type LLMProviderUpdatePayload,
} from "../../types";

interface LLMProviderFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (
    data: LLMProviderCreatePayload | LLMProviderUpdatePayload,
    id?: number, // Present if updating
  ) => Promise<void>;
  initialData?: ApiLLMProviderResponse | null; // If present, it's an edit
}

export function LLMProviderFormDialog({
  open,
  onOpenChange,
  onSubmit,
  initialData,
}: LLMProviderFormDialogProps) {
  const isEditMode = !!initialData;

  const [type, setType] = useState<LLMProviderTypeEnum>(LLMProviderTypeEnum.OpenAI);
  const [name, setName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [embeddingType, setEmbeddingType] = useState("");
  const [modelName, setModelName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);

  const getDefaultsForProviderType = (providerType: LLMProviderTypeEnum) => {
    switch (providerType) {
      case LLMProviderTypeEnum.OpenAI:
        return { apiUrl: "https://api.openai.com/v1", embeddingType: "text-embedding-3-small", modelName: "gpt-4-turbo" };
      case LLMProviderTypeEnum.Claude:
        return { apiUrl: "https://api.anthropic.com/v1", embeddingType: "voyage-code-3", modelName: "claude-3-opus-20240229" };
      case LLMProviderTypeEnum.Ollama:
        return { apiUrl: "http://localhost:11434", embeddingType: "nomic-embed-text", modelName: "llama3" };
      case LLMProviderTypeEnum.Gemini:
        return { apiUrl: "https://generativelanguage.googleapis.com/v1", embeddingType: "embedding-001", modelName: "gemini-1.5-pro-latest" };
      default:
        return { apiUrl: "", embeddingType: "", modelName: "" };
    }
  };

  useEffect(() => {
    if (isEditMode && initialData) {
      setType(initialData.type);
      setName(initialData.name);
      setApiKey(""); // Don't show existing API key
      setApiUrl(initialData.apiUrl || "");
      setEmbeddingType(initialData.embeddingType);
      setModelName(initialData.modelName);
    } else {
      // Set defaults for Add mode based on initial type
      const defaults = getDefaultsForProviderType(LLMProviderTypeEnum.OpenAI);
      setType(LLMProviderTypeEnum.OpenAI);
      setName("");
      setApiKey("");
      setApiUrl(defaults.apiUrl);
      setEmbeddingType(defaults.embeddingType);
      setModelName(defaults.modelName);
    }
    setError("");
  }, [open, initialData, isEditMode]); // Reset form when dialog opens or mode changes

  const handleProviderChange = (value: string) => {
    const providerType = value as LLMProviderTypeEnum;
    setType(providerType);
    const defaults = getDefaultsForProviderType(providerType);
    setApiUrl(defaults.apiUrl);
    setEmbeddingType(defaults.embeddingType);
    setModelName(defaults.modelName);
    if (providerType === LLMProviderTypeEnum.Ollama) {
      setApiKey(""); // Clear API key for Ollama
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!name.trim()) { setError("Name is required"); return; }
    if (type !== LLMProviderTypeEnum.Ollama && !apiKey.trim() && !isEditMode) { setError("API Key is required for new non-Ollama providers"); return; }
    if (type !== LLMProviderTypeEnum.Ollama && isEditMode && apiKey.trim() === "" && initialData?.type !== LLMProviderTypeEnum.Ollama) {
        // If editing a non-Ollama provider and API key is cleared, it's an issue unless it was already Ollama
    }
    if (!apiUrl.trim()) { setError("API URL is required"); return; }
    if (!modelName.trim()) { setError("Model Name is required"); return; }
    if (!embeddingType.trim()) { setError("Embedding Type is required"); return; }


    const payload: LLMProviderCreatePayload | LLMProviderUpdatePayload = {
      name,
      type,
      apiUrl,
      modelName,
      embeddingType,
      // Conditionally add apiKey only if it's provided or if it's not Ollama
      ...(apiKey.trim() || type === LLMProviderTypeEnum.Ollama ? { apiKey: type === LLMProviderTypeEnum.Ollama ? "" : apiKey.trim() } : {}),
    };
    
    // For updates, only include changed fields
    let finalPayload: LLMProviderCreatePayload | LLMProviderUpdatePayload = payload;
    if (isEditMode && initialData) {
        const updatePayload: LLMProviderUpdatePayload = {};
        if (name !== initialData.name) updatePayload.name = name;
        if (type !== initialData.type) updatePayload.type = type;
        if (apiKey.trim()) updatePayload.apiKey = apiKey.trim(); // Only send if new key is entered
        if (apiUrl !== (initialData.apiUrl || "")) updatePayload.apiUrl = apiUrl;
        if (modelName !== initialData.modelName) updatePayload.modelName = modelName;
        if (embeddingType !== initialData.embeddingType) updatePayload.embeddingType = embeddingType;
        
        if (Object.keys(updatePayload).length === 0) {
            setError("No changes detected.");
            return;
        }
        finalPayload = updatePayload;
    }


    setIsSubmitting(true);
    try {
      await onSubmit(finalPayload, isEditMode ? initialData?.id : undefined);
      if (!isEditMode) { // Only reset fully if it was an add operation
        // For edit, useEffect will re-populate if initialData changes,
        // or SettingsPage will close it.
      }
      // SettingsPage will handle closing the dialog on successful submit
    } catch (apiError) {
      setError(apiError instanceof Error ? apiError.message : `Failed to ${isEditMode ? 'update' : 'add'} provider.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseDialog = () => {
    onOpenChange(false); // useEffect will handle form reset if needed
  };

  // Provider-specific model options
  const getModelOptions = () => {
    switch (type) {
      case "OpenAI":
        return [
          { value: "gpt-4-turbo", label: "GPT-4 Turbo" },
          { value: "gpt-4o", label: "GPT-4o" },
          { value: "gpt-3.5-turbo", label: "GPT-3.5 Turbo" }
        ];
      case "Claude":
        return [
          { value: "claude-3.7-sonnet", label: "Claude 3.7 Sonnet" },
          { value: "claude-3-opus", label: "Claude 3 Opus" },
          { value: "claude-3.5-sonnet", label: "Claude 3.5 Sonnet" },
          { value: "claude-3-haiku", label: "Claude 3 Haiku" }
        ];
      case "Ollama":
        return [
          { value: "llama3", label: "Llama 3" },
          { value: "mistral", label: "Mistral" },
          { value: "phi3", label: "Phi-3" },
          { value: "custom", label: "Custom Model" }
        ];
      case "Gemini":
        return [
          { value: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
          { value: "gemini-1.5-flash", label: "Gemini 1.5 Flash" }
        ];
      default:
        return [];
    }
  };

  // Provider-specific embedding options
  const getEmbeddingOptions = () => {
    switch (type) {
      case "OpenAI":
        return [
          { value: "text-embedding-3-small", label: "text-embedding-3-small" },
          { value: "text-embedding-3-large", label: "text-embedding-3-large" },
          { value: "text-embedding-ada-002", label: "text-embedding-ada-002" }
        ];
      case "Claude":
        return [
          { value: "voyage-3-large", label: "voyage-3-large" },
          { value: "voyage-3", label: "voyage-3" },
          { value: "voyage-3-lite", label: "voyage-3-lite" },
          { value: "voyage-law-2", label: "voyage-law-2" },
          { value: "voyage-finance-2", label: "voyage-finance-2" },
          { value: "voyage-code-3", label: "voyage-code-3" }
        ];
      case "Ollama":
        return [
          { value: "mxbai-embed-large", label: "mxbai-embed-large" },
          { value: "nomic-embed-text", label: "nomic-embed-text" },
          { value: "bge-m3", label: "bge-m3" },
          { value: "snowflake-arctic-embed", label: "snowflake-arctic-embed" },
          { value: "all-minilm", label: "all-minilm" },
          { value: "bge-large", label: "bge-large" },
          { value: "snowflake-arctic-embed2", label: "snowflake-arctic-embed2" },
          { value: "paraphrase-multilingual", label: "paraphrase-multilingual" },
          { value: "granite-embedding", label: "granite-embedding" },
        ];
      case "Gemini":
        return [
          { value: "embedding-001", label: "embedding-001" },
          { value: "gemini-embedding-exp-03-07", label: "gemini-embedding-exp-03-07" },
          { value: "text-embedding-004", label: "text-embedding-004" }
        ];
      default:
        return [];
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleCloseDialog}>
      <DialogContent className="sm:max-w-[550px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? "Edit" : "Add"} LLM Provider</DialogTitle>
            <DialogDescription>
              {isEditMode ? "Update the configuration for" : "Configure a new LLM provider for"} chat functionality.
              {isEditMode && initialData && <span className="font-semibold"> ({initialData.name})</span>}
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            {/* Form fields remain largely the same, but values are driven by state */}
            {/* Example: Name field */}
            <Tabs defaultValue="basic" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="basic">Basic Settings</TabsTrigger>
                <TabsTrigger value="advanced">Advanced Settings</TabsTrigger>
              </TabsList>
              
              <TabsContent value="basic" className="space-y-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="form-provider-type">Provider Type</Label>
                  <Select value={type} onValueChange={handleProviderChange}>
                    <SelectTrigger id="form-provider-type"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={LLMProviderTypeEnum.OpenAI}>OpenAI</SelectItem>
                      <SelectItem value={LLMProviderTypeEnum.Claude}>Anthropic (Claude)</SelectItem>
                      <SelectItem value={LLMProviderTypeEnum.Ollama}>Ollama</SelectItem>
                      <SelectItem value={LLMProviderTypeEnum.Gemini}>Google (Gemini)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="form-name">Display Name</Label>
                  <Input id="form-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={`My ${type} Provider`} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="form-api-key">API Key</Label>
                  <div className="flex">
                    <Input
                      id="form-api-key" type={showApiKey ? "text" : "password"} value={apiKey}
                      onChange={(e) => setApiKey(e.target.value)}
                      placeholder={isEditMode ? "Leave blank to keep current" : (type === LLMProviderTypeEnum.Ollama ? "No API key needed" : "sk-...")}
                      disabled={type === LLMProviderTypeEnum.Ollama && !isEditMode} // Allow editing if it was mistakenly set for Ollama
                      className="flex-1 rounded-r-none"
                    />
                     <Button type="button" variant="outline" size="icon" className="rounded-l-none" onClick={() => setShowApiKey(!showApiKey)} aria-label={showApiKey ? "Hide API key" : "Show API key"}>
                      {showApiKey ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
                    </Button>
                  </div>
                   {isEditMode && type !== LLMProviderTypeEnum.Ollama && <p className="text-xs text-muted-foreground">Leave blank to keep the current API key.</p>}
                </div>
                 <div className="grid gap-2">
                  <Label htmlFor="form-api-url">API URL</Label>
                  <Input id="form-api-url" value={apiUrl} onChange={(e) => setApiUrl(e.target.value)} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="form-model">Model</Label>
                  <Select value={modelName} onValueChange={setModelName}>
                    <SelectTrigger id="form-model"><SelectValue /></SelectTrigger>
                    <SelectContent>{getModelOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </TabsContent>
              <TabsContent value="advanced" className="space-y-4 mt-4">
                <div className="grid gap-2">
                  <Label htmlFor="form-embedding-type">Embedding Model</Label>
                  <Select value={embeddingType} onValueChange={setEmbeddingType}>
                    <SelectTrigger id="form-embedding-type"><SelectValue /></SelectTrigger>
                    <SelectContent>{getEmbeddingOptions().map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </TabsContent>
            </Tabs>
            {error && <p className="text-sm font-medium text-red-500 py-2">{error}</p>}
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} type="button">Cancel</Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (isEditMode ? "Updating..." : "Adding...") : (isEditMode ? "Update Provider" : "Add Provider")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}