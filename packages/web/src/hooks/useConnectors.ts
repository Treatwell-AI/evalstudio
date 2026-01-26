import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateConnectorInput, UpdateConnectorInput, Message } from "../lib/api";

export function useConnectors(projectId?: string) {
  return useQuery({
    queryKey: ["connectors", projectId],
    queryFn: () => api.connectors.list(projectId),
  });
}

export function useConnector(id: string | null) {
  return useQuery({
    queryKey: ["connectors", "detail", id],
    queryFn: () => api.connectors.get(id!),
    enabled: !!id,
  });
}

export function useConnectorTypes() {
  return useQuery({
    queryKey: ["connectors", "types"],
    queryFn: () => api.connectors.getTypes(),
    staleTime: Infinity, // Types don't change frequently
  });
}

export function useCreateConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConnectorInput) => api.connectors.create(input),
    onSuccess: (connector) => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
      queryClient.invalidateQueries({
        queryKey: ["connectors", connector.projectId],
      });
    },
  });
}

export function useUpdateConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateConnectorInput }) =>
      api.connectors.update(id, input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useDeleteConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => api.connectors.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
    },
  });
}

export function useTestConnector() {
  return useMutation({
    mutationFn: (id: string) => api.connectors.test(id),
  });
}

export function useInvokeConnector() {
  return useMutation({
    mutationFn: ({ id, messages }: { id: string; messages: Message[] }) =>
      api.connectors.invoke(id, { messages }),
  });
}
