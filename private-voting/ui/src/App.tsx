import { WalletProvider } from "@/providers/wallet-context";
import { MidnightProvidersProvider } from "@/providers/midnight-providers";
import { WalletWidget } from "@/components/wallet-widget";
import { NetworkBadge } from "@/components/network-badge";
import { ProofServerStatus } from "@/components/proof-server-status";
import { NetworkConfigCard } from "@/components/network-config-card";
import { ProductPanel } from "@/components/product-panel";

// Keep this shell. Edit product-panel.tsx for the user's feature. Do not replace
// NetworkConfigCard with a custom Import/Connect/Fund row, and never hard-code mnLace.

export function App() {
  return (
    <WalletProvider>
      <MidnightProvidersProvider>
        <div className="min-h-screen bg-background">
          <header className="border-b">
            <div className="container mx-auto flex items-center justify-between px-4 py-3">
              <h1 className="text-lg font-semibold">private-voting</h1>
              <div className="flex items-center gap-3">
                <NetworkBadge />
                <ProofServerStatus />
                <WalletWidget />
              </div>
            </div>
          </header>
          <main className="container mx-auto flex flex-col gap-6 px-4 py-8">
            <NetworkConfigCard />
            <ProductPanel />
          </main>
        </div>
      </MidnightProvidersProvider>
    </WalletProvider>
  );
}
