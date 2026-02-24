import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function useEvaluatorTypes() {
  return useQuery({
    queryKey: ["evaluator-types"],
    queryFn: () => api.evaluatorTypes.list(),
  });
}
