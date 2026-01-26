import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreatePersonaInput, UpdatePersonaInput } from "../lib/api";

export function usePersonas(projectId?: string) {
  return useQuery({
    queryKey: ["personas", projectId],
    queryFn: () => api.personas.list(projectId),
  });
}

export function usePersona(id: string | null) {
  return useQuery({
    queryKey: ["personas", "detail", id],
    queryFn: () => api.personas.get(id!),
    enabled: !!id,
  });
}

export function useCreatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePersonaInput) => api.personas.create(input),
    onSuccess: (persona) => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
      queryClient.invalidateQueries({
        queryKey: ["personas", persona.projectId],
      });
    },
  });
}

export function useUpdatePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdatePersonaInput }) =>
      api.personas.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
    },
  });
}

export function useDeletePersona() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.personas.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["personas"] });
    },
  });
}
