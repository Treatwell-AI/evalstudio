import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "../App";

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("App", () => {
  it("renders the header", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("EvalStudio")).toBeInTheDocument();
  });

  it("renders Projects section", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("Projects")).toBeInTheDocument();
  });

  it("renders New Project button", () => {
    renderWithProviders(<App />);
    expect(screen.getByText("+ New Project")).toBeInTheDocument();
  });
});
