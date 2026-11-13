import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWallet } from "@/hooks/use-wallet";

export function NetworkConfigCard() {
  const {
    config,
    mismatch,
    error,
    funding,
    mode,
    status,
    importConfig,
    importFromText,
    connectTestWallet,
    fund,
  } = useWallet();
  const [paste, setPaste] = useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle>Undeployed network</CardTitle>
        <CardDescription>
          {config
            ? `Config loaded (${config.networkId}). Copy again in Studio after a network restart.`
            : "In Studio press Copy config, then Import config here."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={() => void importConfig()}>
            Import config
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void connectTestWallet()}
            disabled={status === "connecting"}
          >
            Use test wallet
          </Button>
          {mode === "extension" && status === "connected" ? (
            <Button type="button" onClick={() => void fund()} disabled={funding}>
              {funding ? "Funding…" : "Fund this wallet"}
            </Button>
          ) : null}
        </div>
        <textarea
          className="min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-xs"
          placeholder="Paste midnight-config JSON if the clipboard is blocked"
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          aria-label="Paste network config"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={!paste.trim()}
          onClick={() => {
            importFromText(paste);
            setPaste("");
          }}
        >
          Import pasted JSON
        </Button>
        {mismatch ? (
          <div className="rounded-md border border-destructive/40 p-3 text-xs">
            <p className="font-medium text-destructive">
              Wallet Undeployed URLs do not match this project. Set them in Lace or 1AM, then
              connect again.
            </p>
            <ul className="mt-2 space-y-1 font-mono text-muted-foreground">
              <li>Node RPC: {mismatch.node}</li>
              <li>Indexer: {mismatch.indexer}</li>
              <li>Proof server: {mismatch.proofServer}</li>
            </ul>
          </div>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </CardContent>
    </Card>
  );
}
