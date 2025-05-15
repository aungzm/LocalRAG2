"use client";

import { type ApiWatchedFolderResponse, type ApiLLMProviderResponse } from "../../types"; // Added ApiLLMProviderResponse
import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Button } from "../ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import { MoreHorizontal, Folder, RefreshCw, Edit, Trash2} from "lucide-react"; // Consider a CPU/AI icon
import { formatDistanceToNow } from "date-fns";
import { Badge } from "../ui/badge"; // For LLM Provider badge

interface WatchedFolderListProps {
  folders: ApiWatchedFolderResponse[];
  onDelete: (id: number) => void;
  onEdit: (folder: ApiWatchedFolderResponse) => void;
  llmProviders: ApiLLMProviderResponse[]; // To find provider name by ID
}

export function WatchedFolderList({
  folders,
  onDelete,
  onEdit,
  llmProviders,
}: WatchedFolderListProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [folderToDelete, setFolderToDelete] = useState<number | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [reindexLoading, setReindexLoading] = useState<Record<number, boolean>>({});


  const getLlmProviderName = (providerId: number | null | undefined): string => {
    if (providerId === null || providerId === undefined) return "N/A";
    const provider = llmProviders.find(p => p.id === providerId);
    return provider ? provider.name : `ID: ${providerId}`;
  };


  const confirmDelete = (id: number) => {
    setFolderToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (folderToDelete !== null) {
      onDelete(folderToDelete);
      setDeleteConfirmOpen(false);
      setFolderToDelete(null);
    }
  };

  const handleReindex = async (folderId: number) => {
    setReindexLoading(prev => ({ ...prev, [folderId]: true }));
    try {
      // Replace with your actual API endpoint for re-indexing
      const response = await fetch(`/api/v1/watched-folders/${folderId}/reindex`, { // Example endpoint
        method: "POST",
      });
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || `Failed to reindex folder ${folderId}`);
      }
      // Optionally, show a success message or refresh folder data
      alert(`Folder ${folderId} re-indexing process started.`); // Simple feedback
    } catch (error) {
      console.error("Reindex error:", error);
      alert(`Error re-indexing folder: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setReindexLoading(prev => ({ ...prev, [folderId]: false }));
    }
  };


  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead> {/* New Column */}
              <TableHead>Path</TableHead>
              <TableHead>Embedding Provider</TableHead> {/* New Column */}
              <TableHead>Vector DB File</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-24 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {folders.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6} // Adjusted colSpan
                  className="text-center py-6 text-muted-foreground"
                >
                  No folders configured. Add a folder to get started.
                </TableCell>
              </TableRow>
            ) : (
              folders.map((folder) => (
                <TableRow key={folder.id}>
                  <TableCell className="font-medium">{folder.name}</TableCell> {/* Display Name */}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Folder className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate" title={folder.path}>{folder.path}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                     <Badge variant="outline" className="whitespace-nowrap">
                        {getLlmProviderName(folder.llmProviderId)}
                     </Badge>
                  </TableCell>
                  <TableCell className="truncate" title={folder.vectorDbFilename}>{folder.vectorDbFilename}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {formatDistanceToNow(new Date(folder.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem
                          onClick={() => handleReindex(folder.id)}
                          disabled={reindexLoading[folder.id]}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <RefreshCw className={`h-4 w-4 mr-2 ${reindexLoading[folder.id] ? 'animate-spin' : ''}`} />
                          {reindexLoading[folder.id] ? 'Reindexing...' : 'Reindex'}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => onEdit(folder)}
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => confirmDelete(folder.id)}
                          className="text-red-600 flex items-center gap-2 cursor-pointer hover:!text-red-600 hover:!bg-red-50"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <AlertDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the watched folder configuration. The actual
              folder and its contents on your file system will not be affected,
              but the associated vector database will be removed.
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
