import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateScenarioInput, UpdateScenarioInput } from "../lib/api";
import { useProjectId } from "./useProjectId";

export function useScenarios() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["scenarios", projectId],
    queryFn: () => api.scenarios.list(projectId),
  });
}

export function useScenario(id: string | null) {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["scenarios", projectId, "detail", id],
    queryFn: () => api.scenarios.get(projectId, id!),
    enabled: !!id,
  });
}

export function useCreateScenario() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateScenarioInput) => api.scenarios.create(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", projectId] });
    },
  });
}

export function useUpdateScenario() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateScenarioInput }) =>
      api.scenarios.update(projectId, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", projectId] });
    },
  });
}

export function useDeleteScenario() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.scenarios.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["scenarios", projectId] });
    },
  });
}

export function useScenarioPrompt(scenarioId: string | null, personaId: string | null) {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["scenarios", projectId, "prompt", scenarioId, personaId],
    queryFn: () => api.scenarios.getPrompt(projectId, scenarioId!, personaId || undefined),
    enabled: !!scenarioId,
  });
}
