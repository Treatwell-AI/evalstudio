import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, CreateConnectorInput, UpdateConnectorInput, Message } from "../lib/api";

export function useConnectors() {
  return useQuery({
    queryKey: ["connectors"],
    queryFn: () => api.connectors.list(),
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
    staleTime: Infinity,
  });
}

export function useCreateConnector() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateConnectorInput) => api.connectors.create(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["connectors"] });
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
