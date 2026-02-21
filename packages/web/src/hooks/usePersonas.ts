import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreatePersonaInput, UpdatePersonaInput } from "../lib/api";
import { useProjectId } from "./useProjectId";

export function usePersonas() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["personas", projectId],
    queryFn: () => api.personas.list(projectId),
  });
}

export function usePersona(id: string | null) {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["personas", projectId, "detail", id],
    queryFn: () => api.personas.get(projectId, id!),
    enabled: !!id,
  });
}

export function useCreatePersona() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePersonaInput) => api.personas.create(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas", projectId] });
    },
  });
}

export function useUpdatePersona() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePersonaInput }) =>
      api.personas.update(projectId, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas", projectId] });
    },
  });
}

export function useDeletePersona() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.personas.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas", projectId] });
    },
  });
}

export function useGeneratePersonaImage() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.personas.generateImage(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas", projectId] });
    },
  });
}
