import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateProjectInput, UpdateProjectInput } from "../lib/api";

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: api.projects.list,
  });
}

export function useProject(id: string | null) {
  return useQuery({
    queryKey: ["projects", id],
    queryFn: () => api.projects.get(id!),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateProjectInput) => api.projects.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateProjectInput }) =>
      api.projects.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useDeleteProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.projects.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}
