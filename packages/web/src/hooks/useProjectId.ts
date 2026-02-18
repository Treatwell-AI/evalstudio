import { useParams } from "react-router-dom";

/**
 * Returns the current project ID from the URL route params.
 * Must be used within a route that has a :projectId param.
 */
export function useProjectId(): string {
  const { projectId } = useParams<{ projectId: string }>();
  if (!projectId) {
    throw new Error("useProjectId must be used within a route with :projectId param");
  }
  return projectId;
}
