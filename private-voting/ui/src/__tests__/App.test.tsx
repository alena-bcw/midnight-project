import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { App } from "../App";

vi.mock("@/lib/studio-network", () => ({
  ClipboardConfigError: class ClipboardConfigError extends Error {},
  resolveConfig: vi.fn().mockResolvedValue(null),
  detectWallets: vi.fn().mockReturnValue([]),
  importConfigFromClipboard: vi.fn(),
  importConfigFromText: vi.fn(),
  connectExtension: vi.fn(),
  walletMatchesConfig: vi.fn(),
  walletSettingsHint: vi.fn(),
  connectGenesisWallet: vi.fn(),
  fundWallet: vi.fn(),
  createProviders: vi.fn(),
  createProvidersFromWallet: vi.fn(),
}));

vi.mock("private-voting-api", () => ({
  inMemoryPrivateStateProvider: () => ({}),
}));

describe("App", () => {
  it("renders without crashing", () => {
    render(<App />);
    expect(screen.getByText("private-voting")).toBeInTheDocument();
  });

  it("shows Import config, Connect wallet, and Use test wallet", () => {
    render(<App />);
    expect(screen.getByRole("button", { name: "Import config" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Connect wallet" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Use test wallet" })).toBeInTheDocument();
    expect(screen.getByText(/In Studio press Copy config/)).toBeInTheDocument();
    expect(screen.getByText(/Put deploy, join, and the product actions here/)).toBeInTheDocument();
  });
});
