import { useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Folder } from "lucide-react";
import { FileIcon as ReactFileIcon } from "react-file-icon";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { type ApiWatchedFolderResponse, type ApiFileResponse, type FileItem } from "../../types";

// Helper function to get file extension
const getFileExtension = (filename: string): string => {
  return filename.slice(((filename.lastIndexOf(".") - 1) >>> 0) + 2).toLowerCase();
};

// Helper to get file icon props based on extension
const getFileIconProps = (extension: string) => {
  // Default props
  const defaultProps = {
    extension,
    fold: true,
  };

  // Map file types to colors
  switch (extension) {
    // Documents
    case "pdf":
      return { ...defaultProps, color: "#E13F2B" };
    case "doc":
    case "docx":
      return { ...defaultProps, color: "#2C5898" };
    case "xls":
    case "xlsx":
      return { ...defaultProps, color: "#1D6F42" };
    case "ppt":
    case "pptx":
      return { ...defaultProps, color: "#D04423" };
    case "txt":
      return { ...defaultProps, color: "#89D4FF" };
    
    // Images
    case "jpg":
    case "jpeg":
    case "png":
    case "gif":
    case "svg":
    case "webp":
      return { ...defaultProps, color: "#28A745" };
    
    // Code files
    case "html":
      return { ...defaultProps, color: "#E44D26" };
    case "css":
      return { ...defaultProps, color: "#264DE4" };
    case "js":
    case "jsx":
      return { ...defaultProps, color: "#F7DF1E" };
    case "ts":
    case "tsx":
      return { ...defaultProps, color: "#3178C6" };
    case "json":
      return { ...defaultProps, color: "#FAFAFA" };
    case "xml":
      return { ...defaultProps, color: "#FF6600" };
    
    // Archives
    case "zip":
    case "rar":
    case "tar":
    case "gz":
      return { ...defaultProps, color: "#FAAD14" };
    
    // Audio/Video
    case "mp3":
    case "wav":
    case "mp4":
    case "mov":
    case "avi":
      return { ...defaultProps, color: "#6F42C1" };
    
    // Default
    default:
      return { ...defaultProps, color: "#ACACAC" };
  }
};

const mapApiFileToFrontendFileItem = (apiFile: ApiFileResponse): FileItem => ({
  id: apiFile.id,
  name: apiFile.name,
  type: getFileExtension(apiFile.name) || "file",
});

interface FileSidebarProps {
  isOpen: boolean;
  toggleSidebar: () => void;
  watchedFolders: ApiWatchedFolderResponse[]; // From ChatInterface
  selectedWatchedFolderId: number | null; // From ChatInterface
  onWatchedFolderChange: (id: number) => void; // From ChatInterface
}

const FileSidebar: React.FC<FileSidebarProps> = ({
  isOpen,
  toggleSidebar,
  watchedFolders,
  selectedWatchedFolderId,
  onWatchedFolderChange,
}) => {
  const [currentFiles, setCurrentFiles] = useState<FileItem[]>([]);

  useEffect(() => {
    if (selectedWatchedFolderId) {
      const selectedFolder = watchedFolders.find(
        (folder) => folder.id === selectedWatchedFolderId,
      );
      if (selectedFolder && selectedFolder.files) {
        setCurrentFiles(selectedFolder.files.map(mapApiFileToFrontendFileItem));
      } else {
        setCurrentFiles([]);
      }
    } else {
      setCurrentFiles([]);
    }
  }, [selectedWatchedFolderId, watchedFolders]);

  const handleFolderChange = (value: string) => {
    onWatchedFolderChange(Number(value));
  };

  return (
    <div className="relative h-full flex">
      <div
        className={`bg-gray-50 border-l transition-all duration-300 ease-in-out ${
          isOpen ? "w-64" : "w-0 overflow-hidden"
        }`}
      >
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg mb-2">Files & Folders</h2>

          <Select
            value={
              selectedWatchedFolderId
                ? String(selectedWatchedFolderId)
                : ""
            }
            onValueChange={handleFolderChange}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a folder" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Watched Folders</SelectLabel>
                {watchedFolders.map((folder) => (
                  <SelectItem key={folder.id} value={String(folder.id)}>
                    <div className="flex items-center">
                      <Folder size={16} className="mr-2 text-blue-500" />
                      <div>
                        <span className="truncate" title={folder.path}>
                          {folder.path.split(/\/|\\/).pop() || folder.path}
                        </span>
                      </div>
                    </div>
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-y-auto h-[calc(100%-120px)] p-4 space-y-2">
          {currentFiles.length > 0 ? (
            currentFiles.map((file) => {
              const extension = getFileExtension(file.name);
              
              return (
                <div
                  key={file.id}
                  className="flex items-center p-2 hover:bg-gray-100 rounded-md cursor-pointer"
                  title={file.name}
                >
                  <div className="w-5 h-5 mr-2 flex-shrink-0">
                    <ReactFileIcon {...getFileIconProps(extension)} />
                  </div>
                  <span className="truncate">{file.name}</span>
                </div>
              );
            })
          ) : (
            <div className="text-gray-500 text-center py-4">
              {selectedWatchedFolderId ? "No files in this folder" : "Select a folder to view files"}
            </div>
          )}
        </div>
      </div>

      <button
        onClick={toggleSidebar}
        className={`absolute top-4 ${isOpen ? "-left-10" : "-left-10"} bg-gray-200 p-2 rounded-l-md z-10 hover:bg-gray-300`}
        aria-label={isOpen ? "Close file sidebar" : "Open file sidebar"}
      >
        {isOpen ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
    </div>
  );
};

export default FileSidebar;