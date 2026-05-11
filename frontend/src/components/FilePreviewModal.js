import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { X, ExternalLink } from "lucide-react";
import { Button } from "./ui/button";

const FilePreviewModal = ({ isOpen, onClose, fileUrl, fileName, fileType }) => {
  if (!isOpen || !fileUrl) return null;

  const isImage = fileType?.startsWith("image/") || fileUrl.match(/\.(jpeg|jpg|gif|png)$/i) != null;
  const isPdf = fileType === "application/pdf" || fileUrl.toLowerCase().endsWith(".pdf");
  const isVideo = fileType?.startsWith("video/") || fileUrl.match(/\.(mp4|webm|ogg)$/i) != null;
  const isText = fileType?.startsWith("text/") || fileUrl.match(/\.(txt|md|csv)$/i) != null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[800px] h-[80vh] flex flex-col bg-gray-950 border-gray-800 text-gray-100 p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b border-gray-800 bg-gray-900/50 flex-row justify-between items-center space-y-0 relative">
          <div>
            <DialogTitle className="text-xl font-bold bg-gradient-to-r from-teal-400 to-cyan-400 bg-clip-text text-transparent truncate flex-1">
              {fileName || "File Preview"}
            </DialogTitle>
            <DialogDescription className="text-gray-400 mt-1">
              Previewing document directly in the app.
            </DialogDescription>
          </div>
          
          <div className="flex items-center space-x-2">
            <a href={fileUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="border-gray-700 text-gray-300 hover:text-white hover:bg-gray-800">
                <ExternalLink className="w-4 h-4 mr-2" />
                Open External
              </Button>
            </a>
            
            <button
              onClick={onClose}
              className="p-2 ml-4 rounded-full text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </DialogHeader>

        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-gray-950/50">
          {isImage ? (
            <img 
              src={fileUrl} 
              alt={fileName} 
              className="max-w-full max-h-full object-contain rounded border border-gray-800 shadow-lg"
            />
          ) : isPdf ? (
            <iframe 
              src={`${fileUrl}#view=FitH`} 
              className="w-full h-full rounded border border-gray-800" 
              title={fileName}
            />
          ) : isVideo ? (
            <video 
              src={fileUrl} 
              controls 
              className="max-w-full max-h-full rounded border border-gray-800 shadow-lg"
            >
              Your browser does not support the video tag.
            </video>
          ) : isText ? (
            <iframe 
              src={fileUrl} 
              className="w-full h-full bg-white text-black rounded border border-gray-800 p-4" 
              title={fileName}
            />
          ) : (
            <div className="text-center p-8 text-gray-400">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-800 rounded-full flex items-center justify-center">
                <ExternalLink className="w-8 h-8 text-gray-500" />
              </div>
              <p className="text-lg font-medium text-gray-300 mb-2">No preview available</p>
              <p className="text-sm">This file type cannot be previewed in the browser.</p>
              <a href={fileUrl} target="_blank" rel="noopener noreferrer" className="mt-4 inline-block text-teal-400 hover:text-teal-300 transition-colors">
                Download file
              </a>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FilePreviewModal;
