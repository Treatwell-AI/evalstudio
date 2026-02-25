import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { useProjectId } from "./useProjectId";

const STYLEGUIDE_ROLE = "persona-avatar-styleguide";

/** Returns the styleguide image IDs for persona avatar generation */
export function useStyleguideImages() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["images", projectId, STYLEGUIDE_ROLE],
    queryFn: async () => {
      const { ids } = await api.images.listByRole(projectId, STYLEGUIDE_ROLE);
      return ids;
    },
  });
}

/** Upload a new styleguide image */
export function useUploadStyleguideImage() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ imageBase64, filename }: { imageBase64: string; filename?: string }) => {
      const { id } = await api.images.upload(projectId, imageBase64, STYLEGUIDE_ROLE, filename);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images", projectId, STYLEGUIDE_ROLE] });
    },
  });
}

/** Delete a styleguide image */
export function useDeleteStyleguideImage() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (imageId: string) => {
      await api.images.delete(projectId, imageId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["images", projectId, STYLEGUIDE_ROLE] });
    },
  });
}
