import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateEvalInput, UpdateEvalInput } from "../lib/api";

export function useEvals(projectId?: string) {
  return useQuery({
    queryKey: ["evals", projectId],
    queryFn: () => api.evals.list(projectId),
  });
}

export function useEval(id: string | null, expand?: boolean) {
  return useQuery({
    queryKey: ["evals", "detail", id, expand],
    queryFn: () => api.evals.get(id!, expand),
    enabled: !!id,
  });
}

export function useCreateEval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateEvalInput) => api.evals.create(input),
    onSuccess: (evalItem) => {
      queryClient.invalidateQueries({ queryKey: ["evals"] });
      queryClient.invalidateQueries({
        queryKey: ["evals", evalItem.projectId],
      });
    },
  });
}

export function useUpdateEval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateEvalInput }) =>
      api.evals.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals"] });
    },
  });
}

export function useDeleteEval() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.evals.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["evals"] });
    },
  });
}
