import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { WalletProvider } from "../providers/wallet-context";
import {
  MidnightProvidersProvider,
  useMidnightProviders,
} from "../providers/midnight-providers";

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

function TestConsumer() {
  const { isReady, error } = useMidnightProviders();
  return (
    <div>
      <span data-testid="ready">{isReady ? "yes" : "no"}</span>
      <span data-testid="error">{error ?? "none"}</span>
    </div>
  );
}

describe("MidnightProvidersProvider", () => {
  it("starts not ready when wallet is disconnected", () => {
    render(
      <WalletProvider>
        <MidnightProvidersProvider>
          <TestConsumer />
        </MidnightProvidersProvider>
      </WalletProvider>,
    );

    expect(screen.getByTestId("ready")).toHaveTextContent("no");
    expect(screen.getByTestId("error")).toHaveTextContent("none");
  });
});
