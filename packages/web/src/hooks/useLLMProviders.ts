import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateLLMProviderInput, UpdateLLMProviderInput } from "../lib/api";

export function useLLMProviders(projectId?: string) {
  return useQuery({
    queryKey: ["llmProviders", projectId],
    queryFn: () => api.llmProviders.list(projectId),
  });
}

export function useLLMProvider(id: string | null) {
  return useQuery({
    queryKey: ["llmProviders", "detail", id],
    queryFn: () => api.llmProviders.get(id!),
    enabled: !!id,
  });
}

export function useDefaultModels() {
  return useQuery({
    queryKey: ["llmProviders", "models"],
    queryFn: () => api.llmProviders.getModels(),
    staleTime: Infinity, // Models don't change frequently
  });
}

export function useProviderModels(providerId: string | undefined) {
  return useQuery({
    queryKey: ["llmProviders", "providerModels", providerId],
    queryFn: () => api.llmProviders.getProviderModels(providerId!),
    enabled: !!providerId,
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });
}

export function useCreateLLMProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateLLMProviderInput) => api.llmProviders.create(input),
    onSuccess: (provider) => {
      queryClient.invalidateQueries({ queryKey: ["llmProviders"] });
      queryClient.invalidateQueries({
        queryKey: ["llmProviders", provider.projectId],
      });
    },
  });
}

export function useUpdateLLMProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateLLMProviderInput }) =>
      api.llmProviders.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llmProviders"] });
    },
  });
}

export function useDeleteLLMProvider() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.llmProviders.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["llmProviders"] });
    },
  });
}
