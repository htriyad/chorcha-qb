import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useDeleteFolder, getListFoldersQueryKey, getGetFolderStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface DeleteFolderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  folderId: number;
  folderName: string;
  isViewingSelf?: boolean;
}

export function DeleteFolderDialog({ open, onOpenChange, folderId, folderName, isViewingSelf }: DeleteFolderDialogProps) {
  const queryClient = useQueryClient();
  const deleteFolder = useDeleteFolder();
  const [, setLocation] = useLocation();

  const handleDelete = async () => {
    try {
      await deleteFolder.mutateAsync({ id: folderId });
      queryClient.invalidateQueries({ queryKey: getListFoldersQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetFolderStatsQueryKey() });
      onOpenChange(false);
      if (isViewingSelf) {
        setLocation("/");
      }
    } catch (error) {
      console.error("Failed to delete folder:", error);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete the folder <strong>{folderName}</strong> and all of its contents. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={deleteFolder.isPending}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
