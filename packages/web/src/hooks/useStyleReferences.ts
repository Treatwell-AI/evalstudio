import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useProjectId } from "./useProjectId";

/** Returns the style reference image IDs from project config */
export function useStyleReferences() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["project-config", projectId],
    queryFn: () => api.project.getConfig(projectId),
    select: (config) => config.styleReferenceImageIds ?? [],
  });
}

/** Upload an image and add its ID to the project's styleReferenceImageIds */
export function useUploadStyleReference() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageBase64, filename }: { imageBase64: string; filename?: string }) => {
      // Upload the image blob
      const { id } = await api.images.upload(projectId, imageBase64, filename);

      // Get current config to append the new ID
      const config = await api.project.getConfig(projectId);
      const currentIds = config.styleReferenceImageIds ?? [];

      // Update project config with the new ID added
      await api.project.updateConfig(projectId, {
        styleReferenceImageIds: [...currentIds, id],
      });

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-config", projectId] });
    },
  });
}

/** Remove a style reference: delete from project config and delete the image blob */
export function useDeleteStyleReference() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      // Get current config to remove the ID
      const config = await api.project.getConfig(projectId);
      const currentIds = config.styleReferenceImageIds ?? [];

      // Update project config with the ID removed
      await api.project.updateConfig(projectId, {
        styleReferenceImageIds: currentIds.filter((id) => id !== imageId),
      });

      // Delete the image blob
      await api.images.delete(projectId, imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-config", projectId] });
    },
  });
}
