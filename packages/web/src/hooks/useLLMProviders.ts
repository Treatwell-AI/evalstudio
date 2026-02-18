import { useQuery } from "@tanstack/react-query";
import { api, type ModelGroup, type ProviderType } from "../lib/api";

export function useDefaultModels() {
  return useQuery({
    queryKey: ["llmProviders", "models"],
    queryFn: () => api.llmProviders.getModels(),
    staleTime: Infinity,
  });
}

export function useProviderModels(providerType: ProviderType | undefined) {
  return useQuery<ModelGroup[]>({
    queryKey: ["llmProviders", "providerModels", providerType],
    queryFn: () => api.llmProviders.getProviderModels(providerType!),
    enabled: !!providerType,
    staleTime: 5 * 60 * 1000,
  });
}
