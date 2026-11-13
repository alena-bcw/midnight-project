import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  createProviders as createGenesisProviders,
  createProvidersFromWallet,
} from "@/lib/studio-network";
import { inMemoryPrivateStateProvider, type AppProviders } from "private-voting-api";
import { useWallet } from "@/hooks/use-wallet";

interface MidnightProvidersContextValue {
  providers: AppProviders | null;
  isReady: boolean;
  error: string | null;
}

const MidnightProvidersContext =
  createContext<MidnightProvidersContextValue | null>(null);

export function MidnightProvidersProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { connectedApi, genesisWallet, config, mode, status } = useWallet();
  const [providers, setProviders] = useState<AppProviders | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (status !== "connected" || !config) {
      setProviders(null);
      setError(null);
      return;
    }

    let cancelled = false;
    const privateStateProvider = inMemoryPrivateStateProvider();

    const built =
      mode === "test" && genesisWallet
        ? createGenesisProviders(config, genesisWallet as never, privateStateProvider)
        : connectedApi
          ? createProvidersFromWallet(config, connectedApi as never, privateStateProvider)
          : Promise.reject(new Error("No wallet connected"));

    built
      .then((p) => {
        if (!cancelled) {
          setProviders(p as AppProviders);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to create providers");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [connectedApi, genesisWallet, config, mode, status]);

  return (
    <MidnightProvidersContext.Provider
      value={{ providers, isReady: providers !== null, error }}
    >
      {children}
    </MidnightProvidersContext.Provider>
  );
}

export function useMidnightProviders(): MidnightProvidersContextValue {
  const context = useContext(MidnightProvidersContext);
  if (!context) {
    throw new Error(
      "useMidnightProviders must be used within a MidnightProvidersProvider",
    );
  }
  return context;
}
