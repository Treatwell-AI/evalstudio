import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, UpdateProjectConfigInput } from "../lib/api";

export function useProjectConfig() {
  return useQuery({
    queryKey: ["projectConfig"],
    queryFn: api.project.get,
  });
}

export function useUpdateProjectConfig() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: UpdateProjectConfigInput) => api.project.update(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projectConfig"] });
    },
  });
}
