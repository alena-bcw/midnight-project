import {
  createContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  ClipboardConfigError,
  connectExtension,
  connectGenesisWallet,
  detectWallets,
  fundWallet,
  importConfigFromClipboard,
  importConfigFromText,
  resolveConfig,
  walletMatchesConfig,
  walletSettingsHint,
  type DetectedWallet,
  type MidnightConfig,
} from "@/lib/studio-network";

export type WalletConnectionStatus =
  | "disconnected"
  | "connecting"
  | "connected"
  | "error";

export type WalletMode = "extension" | "test" | null;

export interface WalletState {
  status: WalletConnectionStatus;
  mode: WalletMode;
  config: MidnightConfig | null;
  wallets: DetectedWallet[];
  connectedApi: unknown | null;
  genesisWallet: unknown | null;
  shieldedAddress: string | null;
  coinPublicKey: string | null;
  encryptionPublicKey: string | null;
  networkId: string | null;
  mismatch: { node: string; indexer: string; proofServer: string } | null;
  nodeChanged: boolean;
  error: string | null;
  funding: boolean;
}

export interface WalletContextValue extends WalletState {
  importConfig: () => Promise<void>;
  importFromText: (text: string) => void;
  connect: (wallet?: DetectedWallet) => Promise<void>;
  connectTestWallet: () => Promise<void>;
  fund: () => Promise<void>;
  disconnect: () => void;
}

export const WalletContext = createContext<WalletContextValue | null>(null);

const empty: Omit<WalletState, "config" | "wallets"> = {
  status: "disconnected",
  mode: null,
  connectedApi: null,
  genesisWallet: null,
  shieldedAddress: null,
  coinPublicKey: null,
  encryptionPublicKey: null,
  networkId: null,
  mismatch: null,
  nodeChanged: false,
  error: null,
  funding: false,
};

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<WalletState>({
    ...empty,
    config: null,
    wallets: [],
  });

  useEffect(() => {
    setState((prev) => ({ ...prev, wallets: detectWallets() }));
    void resolveConfig().then((config) => {
      setState((prev) => ({ ...prev, config: config ?? prev.config }));
    });
  }, []);

  const importConfig = useCallback(async () => {
    setState((prev) => ({ ...prev, error: null }));
    try {
      const config = await importConfigFromClipboard();
      setState((prev) => ({ ...prev, config, nodeChanged: false, error: null }));
    } catch (err: unknown) {
      if (err instanceof ClipboardConfigError) {
        setState((prev) => ({
          ...prev,
          error: "Clipboard blocked — paste the config JSON below.",
        }));
        return;
      }
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Could not import config",
      }));
    }
  }, []);

  const importFromText = useCallback((text: string) => {
    try {
      const config = importConfigFromText(text);
      setState((prev) => ({ ...prev, config, nodeChanged: false, error: null }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : "Could not import config",
      }));
    }
  }, []);

  const connect = useCallback(async (wallet?: DetectedWallet) => {
    setState((prev) => ({ ...prev, status: "connecting", error: null, mode: "extension" }));
    const found = wallet ?? detectWallets()[0];
    if (!found) {
      setState((prev) => ({
        ...prev,
        status: "error",
        mode: null,
        error:
          "No Midnight wallet extension found. Install Lace or 1AM, then connect.",
      }));
      return;
    }
    try {
      const api = await connectExtension(found, "undeployed");
      const addresses = await (
        api as {
          getShieldedAddresses: () => Promise<{
            shieldedAddress: string;
            shieldedCoinPublicKey: string;
            shieldedEncryptionPublicKey: string;
          }>;
        }
      ).getShieldedAddresses();
      const cfg = (await resolveConfig()) ?? undefined;
      let mismatch: WalletState["mismatch"] = null;
      if (cfg) {
        const match = await walletMatchesConfig(api, cfg);
        if (!match.ok) mismatch = walletSettingsHint(cfg);
      }
      setState((prev) => ({
        ...prev,
        status: "connected",
        mode: "extension",
        wallets: detectWallets(),
        connectedApi: api,
        genesisWallet: null,
        shieldedAddress: addresses.shieldedAddress,
        coinPublicKey: addresses.shieldedCoinPublicKey,
        encryptionPublicKey: addresses.shieldedEncryptionPublicKey,
        networkId: cfg?.networkId ?? "undeployed",
        config: cfg ?? prev.config,
        mismatch,
        error: null,
      }));
    } catch (err: unknown) {
      const message =
        typeof err === "object" && err !== null && "reason" in err
          ? String((err as { reason: string }).reason)
          : err instanceof Error
            ? err.message
            : "Failed to connect to wallet";
      setState((prev) => ({ ...prev, status: "error", mode: null, error: message }));
    }
  }, []);

  const connectTestWallet = useCallback(async () => {
    const cfg = state.config ?? (await resolveConfig());
    if (!cfg) {
      setState((prev) => ({
        ...prev,
        error: "In Studio press Copy config, then Import config here.",
      }));
      return;
    }
    setState((prev) => ({ ...prev, status: "connecting", error: null, mode: "test" }));
    try {
      const genesis = await connectGenesisWallet(cfg);
      setState((prev) => ({
        ...prev,
        status: "connected",
        mode: "test",
        config: cfg,
        connectedApi: null,
        genesisWallet: genesis,
        shieldedAddress: "test wallet (alice)",
        coinPublicKey: null,
        encryptionPublicKey: null,
        networkId: cfg.networkId,
        mismatch: null,
        error: null,
      }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        status: "error",
        mode: null,
        error: err instanceof Error ? err.message : "Test wallet failed",
      }));
    }
  }, [state.config]);

  const fund = useCallback(async () => {
    const cfg = state.config;
    const api = state.connectedApi as {
      getDustAddress?: () => Promise<unknown>;
      getUnshieldedAddress?: () => Promise<unknown>;
    } | null;
    if (!cfg || !api) {
      setState((prev) => ({
        ...prev,
        error: "Connect a wallet and import config before funding.",
      }));
      return;
    }
    setState((prev) => ({ ...prev, funding: true, error: null }));
    try {
      const dustAddress = asString(await api.getDustAddress?.());
      if (!dustAddress) throw new Error("Wallet did not return a DUST address");
      const unshieldedAddress = asString(await api.getUnshieldedAddress?.()) ?? undefined;
      await fundWallet(cfg, { dustAddress, unshieldedAddress });
      setState((prev) => ({ ...prev, funding: false }));
    } catch (err: unknown) {
      setState((prev) => ({
        ...prev,
        funding: false,
        error: err instanceof Error ? err.message : "Funding failed",
      }));
    }
  }, [state.config, state.connectedApi]);

  const disconnect = useCallback(() => {
    setState((prev) => ({
      ...empty,
      config: prev.config,
      wallets: detectWallets(),
    }));
  }, []);

  return (
    <WalletContext.Provider
      value={{
        ...state,
        importConfig,
        importFromText,
        connect,
        connectTestWallet,
        fund,
        disconnect,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
