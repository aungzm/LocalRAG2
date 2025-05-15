"use client";

import { type ApiLLMProviderResponse } from "../../types";
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
import { Badge } from "../ui/badge";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface LLMProviderListProps {
  providers: ApiLLMProviderResponse[];
  onDelete: (id: number) => void;
  onEdit: (provider: ApiLLMProviderResponse) => void; // Prop is declared
}

export function LLMProviderList({
  providers,
  onDelete,
  onEdit, // Destructure onEdit here
}: LLMProviderListProps) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<number | null>(
    null,
  );

  const confirmDelete = (id: number) => {
    setProviderToDelete(id);
    setDeleteConfirmOpen(true);
  };

  const handleDeleteConfirm = () => {
    if (providerToDelete !== null) {
      onDelete(providerToDelete);
      setDeleteConfirmOpen(false);
      setProviderToDelete(null);
    }
  };

  const getProviderBadgeColor = (type: string) => {
    // ... (badge color logic)
    switch (type) {
      case "OpenAI":
        return "bg-green-100 text-green-800 hover:bg-green-100";
      case "Claude":
        return "bg-purple-100 text-purple-800 hover:bg-purple-100";
      case "Ollama":
        return "bg-blue-100 text-blue-800 hover:bg-blue-100";
      case "Gemini":
        return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
      default:
        return "bg-gray-100 text-gray-800 hover:bg-gray-100";
    }
  };

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Provider</TableHead>
              <TableHead>Model</TableHead>
              <TableHead>Last Updated</TableHead>
              <TableHead className="w-24">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {providers.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={4} // Adjusted colSpan
                  className="text-center py-6 text-muted-foreground"
                >
                  No LLM providers configured. Add a provider to get started.
                </TableCell>
              </TableRow>
            ) : (
              providers.map((provider) => (
                <TableRow key={provider.id}>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                      <div className="font-medium">{provider.name}</div>
                      <Badge
                        variant="outline"
                        className={`w-fit ${getProviderBadgeColor(
                          provider.type,
                        )}`}
                      >
                        {provider.type}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>{provider.modelName}</TableCell>
                  <TableCell>
                    {formatDistanceToNow(new Date(provider.updatedAt), { addSuffix: true })}
                  </TableCell>
                  <TableCell>
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
                          onClick={() => onEdit(provider)} // Call onEdit here
                          className="flex items-center gap-2 cursor-pointer"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => confirmDelete(provider.id)}
                          className="text-red-600 flex items-center gap-2 cursor-pointer"
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
              This will remove the LLM provider. Any chats using this provider
              will be affected.
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
