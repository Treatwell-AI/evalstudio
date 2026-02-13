import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreatePlaygroundRunInput, CreateRunInput, Run, UpdateRunInput } from "../lib/api";

export function useRuns(evalId?: string) {
  return useQuery({
    queryKey: ["runs", { evalId }],
    queryFn: () => api.runs.list(evalId),
  });
}

export function useRunsByEval(evalId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["runs", "byEval", evalId],
    queryFn: () => api.runs.list(evalId),
    enabled: !!evalId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRunsByScenario(scenarioId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["runs", "byScenario", scenarioId],
    queryFn: () => api.runs.list(undefined, scenarioId),
    enabled: !!scenarioId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRunsByPersona(personaId: string, options?: { refetchInterval?: number | false }) {
  return useQuery({
    queryKey: ["runs", "byPersona", personaId],
    queryFn: () => api.runs.list(undefined, undefined, personaId),
    enabled: !!personaId,
    refetchInterval: options?.refetchInterval,
  });
}

export function useRun(id: string | null) {
  return useQuery({
    queryKey: ["runs", "detail", id],
    queryFn: () => api.runs.get(id!),
    enabled: !!id,
  });
}

export function useCreateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateRunInput) => api.runs.create(input),
    onSuccess: (runs) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      const evalIds = new Set(runs.map((r) => r.evalId).filter(Boolean));
      for (const evalId of evalIds) {
        queryClient.invalidateQueries({
          queryKey: ["runs", "byEval", evalId],
        });
      }
    },
  });
}

export function useCreatePlaygroundRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreatePlaygroundRunInput) => api.runs.createPlayground(input),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({
        queryKey: ["runs", "byScenario", run.scenarioId],
      });
      if (run.personaId) {
        queryClient.invalidateQueries({
          queryKey: ["runs", "byPersona", run.personaId],
        });
      }
    },
  });
}

export function useUpdateRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateRunInput }) =>
      api.runs.update(id, input),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({
        queryKey: ["runs", "detail", run.id],
      });
    },
  });
}

export function useDeleteRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.runs.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
    },
  });
}

export function useRetryRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, clearMessages }: { id: string; clearMessages?: boolean }) =>
      api.runs.retry(id, { clearMessages }),
    onSuccess: (run) => {
      queryClient.invalidateQueries({ queryKey: ["runs"] });
      queryClient.invalidateQueries({
        queryKey: ["runs", "detail", run.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["runs", "byEval", run.evalId],
      });
    },
  });
}

const POLLING_INTERVAL = 1000;

export function usePollingRun(runId: string | null): {
  run: Run | undefined;
  isLoading: boolean;
} {
  const { data: run, isLoading, refetch } = useRun(runId);

  const shouldPoll = run && (run.status === "queued" || run.status === "running");

  useEffect(() => {
    if (!shouldPoll) return;

    const interval = setInterval(() => {
      refetch();
    }, POLLING_INTERVAL);

    return () => clearInterval(interval);
  }, [shouldPoll, refetch]);

  return { run, isLoading };
}
