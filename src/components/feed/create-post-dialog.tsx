"use client";

import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { CreatePostCard } from "./create-post-card";

interface CreatePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostCreated?: () => void;
}

export function CreatePostDialog({ open, onOpenChange, onPostCreated }: CreatePostDialogProps) {
  const handlePostCreated = () => {
    onOpenChange(false);
    onPostCreated?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] p-0 gap-0 !rounded-2xl overflow-hidden">
        <DialogTitle className="sr-only">Novo post</DialogTitle>
        <CreatePostCard onPostCreated={handlePostCreated} />
      </DialogContent>
    </Dialog>
  );
}
