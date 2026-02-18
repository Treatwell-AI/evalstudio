import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateEvalInput, UpdateEvalInput } from "../lib/api";
import { useProjectId } from "./useProjectId";

export function useEvals() {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["evals", projectId],
    queryFn: () => api.evals.list(projectId),
  });
}

export function useEval(id: string | null, expand?: boolean) {
  const projectId = useProjectId();

  return useQuery({
    queryKey: ["evals", projectId, "detail", id, expand],
    queryFn: () => api.evals.get(projectId, id!, expand),
    enabled: !!id,
  });
}

export function useCreateEval() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEvalInput) => api.evals.create(projectId, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals", projectId] });
    },
  });
}

export function useUpdateEval() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEvalInput }) =>
      api.evals.update(projectId, id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals", projectId] });
    },
  });
}

export function useDeleteEval() {
  const projectId = useProjectId();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.evals.delete(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals", projectId] });
    },
  });
}
