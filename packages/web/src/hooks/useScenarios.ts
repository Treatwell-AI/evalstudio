import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateScenarioInput, UpdateScenarioInput } from "../lib/api";

export function useScenarios(projectId?: string) {
  return useQuery({
    queryKey: ["scenarios", projectId],
    queryFn: () => api.scenarios.list(projectId),
  });
}

export function useScenario(id: string | null) {
  return useQuery({
    queryKey: ["scenarios", "detail", id],
    queryFn: () => api.scenarios.get(id!),
    enabled: !!id,
  });
}

export function useCreateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScenarioInput) => api.scenarios.create(input),
    onSuccess: (scenario) => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
      queryClient.invalidateQueries({
        queryKey: ["scenarios", scenario.projectId],
      });
    },
  });
}

export function useUpdateScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScenarioInput }) =>
      api.scenarios.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}

export function useDeleteScenario() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.scenarios.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios"] });
    },
  });
}

export function useScenarioPrompt(scenarioId: string | null, personaId: string | null) {
  return useQuery({
    queryKey: ["scenarios", "prompt", scenarioId, personaId],
    queryFn: () => api.scenarios.getPrompt(scenarioId!, personaId || undefined),
    enabled: !!scenarioId,
  });
}
