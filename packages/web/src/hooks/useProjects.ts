import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, UpdateProjectConfigInput } from "../lib/api";
import { useProjectId } from "./useProjectId";

export function useProjectsList() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.projects.list,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (name: string) => api.projects.create(name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => api.projects.delete(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useProjectConfig() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["projectConfig", projectId],
    queryFn: () => api.project.getConfig(projectId),
  });
}

export function useUpdateProjectConfig() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectConfigInput) => api.project.updateConfig(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectConfig", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
