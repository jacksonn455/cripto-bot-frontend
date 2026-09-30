import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { EmptyState } from "./empty-state";
import { ErrorState } from "./error-state";

describe("ErrorState", () => {
  it("explains an offline backend and retries on click", async () => {
    const onRetry = vi.fn();
    render(<ErrorState error={new ApiError("offline", "x", 503)} onRetry={onRetry} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Backend offline");
    await userEvent.click(screen.getByRole("button", { name: /tentar de novo/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it("shows the backend message for HTTP errors", () => {
    render(<ErrorState error={new ApiError("http", "Trade abc not found", 404)} />);
    expect(screen.getByText("Não encontrado")).toBeInTheDocument();
    expect(screen.getByText("Trade abc not found")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and explanation", () => {
    render(<EmptyState title="Nenhuma trade" description="O Krypto ainda não abriu posições neste modo." />);
    expect(screen.getByText("Nenhuma trade")).toBeInTheDocument();
    expect(screen.getByText(/ainda não abriu posições/)).toBeInTheDocument();
  });
});
