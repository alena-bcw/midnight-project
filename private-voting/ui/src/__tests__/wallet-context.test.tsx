import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { WalletProvider } from "../providers/wallet-context";
import { useWallet } from "../hooks/use-wallet";

const CFG = {
  status: "ready" as const,
  networkId: "undeployed",
  node: "https://net.run.app/rpc",
  nodeWS: "wss://net.run.app/rpc",
  indexer: "https://net.run.app/indexer",
  indexerWS: "wss://net.run.app/indexer",
  proofServer: "https://net.run.app/prove",
  wallets: [{ name: "alice", seed: "01" }],
};

const resolveConfig = vi.fn();
const detectWallets = vi.fn();
const importConfigFromClipboard = vi.fn();
const importConfigFromText = vi.fn();
const connectExtension = vi.fn();
const walletMatchesConfig = vi.fn();
const walletSettingsHint = vi.fn();
const connectGenesisWallet = vi.fn();
const fundWallet = vi.fn();

vi.mock("@/lib/studio-network", () => ({
  ClipboardConfigError: class ClipboardConfigError extends Error {
    constructor() {
      super("clipboard");
      this.name = "ClipboardConfigError";
    }
  },
  resolveConfig: (...args: unknown[]) => resolveConfig(...args),
  detectWallets: (...args: unknown[]) => detectWallets(...args),
  importConfigFromClipboard: (...args: unknown[]) => importConfigFromClipboard(...args),
  importConfigFromText: (...args: unknown[]) => importConfigFromText(...args),
  connectExtension: (...args: unknown[]) => connectExtension(...args),
  walletMatchesConfig: (...args: unknown[]) => walletMatchesConfig(...args),
  walletSettingsHint: (...args: unknown[]) => walletSettingsHint(...args),
  connectGenesisWallet: (...args: unknown[]) => connectGenesisWallet(...args),
  fundWallet: (...args: unknown[]) => fundWallet(...args),
}));

function TestConsumer() {
  const { status, shieldedAddress, error, config, connect, importConfig } = useWallet();
  return (
    <div>
      <span data-testid="status">{status}</span>
      <span data-testid="address">{shieldedAddress ?? "none"}</span>
      <span data-testid="error">{error ?? "none"}</span>
      <span data-testid="config">{config ? config.node : "none"}</span>
      <button onClick={() => void connect()}>connect</button>
      <button onClick={() => void importConfig()}>import</button>
    </div>
  );
}

describe("WalletContext", () => {
  beforeEach(() => {
    resolveConfig.mockResolvedValue(null);
    detectWallets.mockReturnValue([]);
    importConfigFromClipboard.mockReset();
    importConfigFromText.mockReset();
    connectExtension.mockReset();
    walletMatchesConfig.mockReset();
    walletSettingsHint.mockReset();
    connectGenesisWallet.mockReset();
    fundWallet.mockReset();
  });

  it("starts disconnected with no config", async () => {
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    expect(screen.getByTestId("status")).toHaveTextContent("disconnected");
    await vi.waitFor(() => {
      expect(screen.getByTestId("config")).toHaveTextContent("none");
    });
  });

  it("imports config from the clipboard", async () => {
    importConfigFromClipboard.mockResolvedValue(CFG);
    const user = userEvent.setup();
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    await user.click(screen.getByText("import"));
    await vi.waitFor(() => {
      expect(screen.getByTestId("config")).toHaveTextContent(CFG.node);
    });
  });

  it("shows error when wallet not found", async () => {
    const user = userEvent.setup();
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    await user.click(screen.getByText("connect"));
    expect(screen.getByTestId("status")).toHaveTextContent("error");
    expect(screen.getByTestId("error")).toHaveTextContent("Midnight wallet");
  });

  it("connects an injected wallet without hard-coding mnLace", async () => {
    const api = {
      getShieldedAddresses: vi.fn().mockResolvedValue({
        shieldedAddress: "mn_shield_test1abc123",
        shieldedCoinPublicKey: "coinpub123",
        shieldedEncryptionPublicKey: "encpub123",
      }),
    };
    detectWallets.mockReturnValue([
      { key: "uuid-1", name: "Lace", icon: "", rdns: "io.midnight.lace", api: {} },
    ]);
    connectExtension.mockResolvedValue(api);
    resolveConfig.mockResolvedValue(CFG);
    walletMatchesConfig.mockResolvedValue({ ok: true, wallet: {} });
    const user = userEvent.setup();
    render(
      <WalletProvider>
        <TestConsumer />
      </WalletProvider>,
    );
    await user.click(screen.getByText("connect"));
    await vi.waitFor(() => {
      expect(screen.getByTestId("status")).toHaveTextContent("connected");
    });
    expect(connectExtension).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Lace" }),
      "undeployed",
    );
    expect(screen.getByTestId("address")).toHaveTextContent("mn_shield_test1abc123");
  });
});
