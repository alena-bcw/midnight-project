// studio-network.ts — copy into the UI (e.g. ui/src/lib/studio-network.ts) and use it as-is.
// Wallet sync takes <1 s; a contract deploy ~20 s.
//
// The studio serves the published dApp at /apps/<id>/ next to `midnight-config.json` (this
// project's private `undeployed` network + genesis wallets). Prefer Import config (Studio's
// Copy config) so a network restart does not need a rebuild. After connect('undeployed'),
// node / indexer / proof come from the wallet's getConfiguration(); the imported JSON is for
// the test wallet, Fund this wallet, and a mismatch check against Lace / 1AM Undeployed URLs.
//
// UI dependencies (match the versions already in the template; add what is missing):
//   @midnight-ntwrk/wallet-sdk 1.2.0, @midnight-ntwrk/ledger-v8 ^8.1.0, rxjs, buffer,
//   @midnight-ntwrk/midnight-js-{contracts,fetch-zk-config-provider,http-client-proof-provider,
//   indexer-public-data-provider,network-id,utils} ^4.1.1
//
// Usage:
//   const cfg = await resolveConfig();                 // imported JSON, else ./midnight-config.json
//   const wallets = detectWallets();                   // Lace, 1AM, others — never hard-code mnLace
//   const api = await connectExtension(wallets[0]);
//   const match = await walletMatchesConfig(api, cfg); // on mismatch, show walletSettingsHint(cfg)
//   await fundWallet(cfg, { dustAddress, unshieldedAddress });
//   const providers = await createProvidersFromWallet(cfg, api, privateStateProvider);
//   // or: connectGenesisWallet(cfg) + createProviders(cfg, wallet, privateStateProvider)
//
// Keep this file. Do not replace Import config / Use test wallet / Fund with empty
// onClick stubs or window.midnight.mnLace. Wallet-sdk loads only when those run.
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';

/** Pure helpers shared with `studio-network.ts.txt` (no Midnight SDK). */

export interface MidnightConfig {
  status: 'ready';
  networkId: string;
  node: string;
  nodeWS: string;
  indexer: string;
  indexerWS: string;
  proofServer: string;
  wallets: { name: string; seed: string }[];
}

export interface DetectedWallet {
  key: string;
  name: string;
  icon: string;
  rdns: string;
  api: WalletInitialApi;
}

export interface WalletInitialApi {
  name?: string;
  icon?: string;
  rdns?: string;
  connect: (networkId: string) => Promise<unknown>;
}

export interface WalletNetworkConfiguration {
  indexerUri: string;
  indexerWsUri?: string;
  substrateNodeUri: string;
  proverServerUri?: string;
  networkId: string;
}

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
};

function asRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error(`invalid config: ${label}`);
  }
  return value as Record<string, unknown>;
}

function reqString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`invalid config: ${field}`);
  return value;
}

/** Full midnight-config.json shape, including genesis wallets. */
export function parseNetworkConfig(text: string): MidnightConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text) as unknown;
  } catch {
    throw new Error('invalid config: json');
  }
  const obj = asRecord(parsed, 'root');
  if (obj.status !== 'ready') throw new Error('invalid config: status');
  const walletsRaw = obj.wallets;
  if (!Array.isArray(walletsRaw) || walletsRaw.length === 0) {
    throw new Error('invalid config: wallets');
  }
  const wallets = walletsRaw.map((w, i) => {
    const row = asRecord(w, `wallets[${i}]`);
    return { name: reqString(row.name, `wallets[${i}].name`), seed: reqString(row.seed, `wallets[${i}].seed`) };
  });
  return {
    status: 'ready',
    networkId: reqString(obj.networkId, 'networkId'),
    node: reqString(obj.node, 'node'),
    nodeWS: reqString(obj.nodeWS, 'nodeWS'),
    indexer: reqString(obj.indexer, 'indexer'),
    indexerWS: reqString(obj.indexerWS, 'indexerWS'),
    proofServer: reqString(obj.proofServer, 'proofServer'),
    wallets,
  };
}

function pageHref(): string {
  const doc = (globalThis as { document?: { baseURI: string } }).document;
  return doc ? new URL('.', doc.baseURI).href : 'local';
}

function defaultStorage(): StorageLike | null {
  return (globalThis as { localStorage?: StorageLike }).localStorage ?? null;
}

export function configStorageKey(href = pageHref()): string {
  return `vc.midnight-config:${href}`;
}

export function saveConfig(
  cfg: MidnightConfig,
  storage: StorageLike | null = defaultStorage(),
  key = configStorageKey(),
): void {
  storage?.setItem(key, JSON.stringify(cfg));
}

export function loadSavedConfig(
  storage: StorageLike | null = defaultStorage(),
  key = configStorageKey(),
): MidnightConfig | null {
  const raw = storage?.getItem(key);
  if (!raw) return null;
  try {
    return parseNetworkConfig(raw);
  } catch {
    return null;
  }
}

export function clearSavedConfig(
  storage: StorageLike | null = defaultStorage(),
  key = configStorageKey(),
): void {
  storage?.removeItem(key);
}

export function nodeUrlChanged(previous: MidnightConfig | null, next: MidnightConfig): boolean {
  return !!previous && previous.node !== next.node;
}

function stripSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export function urlsMatch(a: string | undefined, b: string | undefined): boolean {
  if (!a || !b) return false;
  return stripSlash(a) === stripSlash(b);
}

/** Compare wallet `getConfiguration()` indexer/node to the imported config. */
export function configurationMatches(
  wallet: WalletNetworkConfiguration,
  cfg: MidnightConfig,
): boolean {
  const indexerOk = urlsMatch(wallet.indexerUri, cfg.indexer);
  const nodeOk =
    urlsMatch(wallet.substrateNodeUri, cfg.node) || urlsMatch(wallet.substrateNodeUri, cfg.nodeWS);
  return indexerOk && nodeOk;
}

export async function walletMatchesConfig(
  api: { getConfiguration: () => Promise<WalletNetworkConfiguration> },
  cfg: MidnightConfig,
): Promise<{ ok: boolean; wallet: WalletNetworkConfiguration }> {
  const wallet = await api.getConfiguration();
  return { ok: configurationMatches(wallet, cfg), wallet };
}

/**
 * Enumerate `window.midnight`, dropping Lace's `mnLace` alias by object identity.
 */
export function detectWallets(
  midnight: Record<string, WalletInitialApi | undefined> | undefined = (
    globalThis as { window?: { midnight?: Record<string, WalletInitialApi | undefined> } }
  ).window?.midnight,
): DetectedWallet[] {
  if (!midnight) return [];
  const seen = new Set<object>();
  const out: DetectedWallet[] = [];
  for (const [key, api] of Object.entries(midnight)) {
    if (!api || typeof api.connect !== 'function') continue;
    if (seen.has(api)) continue;
    seen.add(api);
    out.push({
      key,
      name: api.name ?? key,
      icon: typeof api.icon === 'string' ? api.icon : '',
      rdns: typeof api.rdns === 'string' ? api.rdns : '',
      api,
    });
  }
  return out;
}

export function walletSettingsHint(cfg: MidnightConfig): {
  node: string;
  nodeWS: string;
  indexer: string;
  indexerWS: string;
  proofServer: string;
} {
  return {
    node: cfg.node,
    nodeWS: cfg.nodeWS,
    indexer: cfg.indexer,
    indexerWS: cfg.indexerWS,
    proofServer: cfg.proofServer,
  };
}


export class ClipboardConfigError extends Error {
  constructor() {
    super('clipboard');
    this.name = 'ClipboardConfigError';
  }
}

export type ConnectedWalletApi = {
  getConfiguration: () => Promise<WalletNetworkConfiguration>;
  getShieldedAddresses: () => Promise<{
    shieldedCoinPublicKey: string;
    shieldedEncryptionPublicKey: string;
  }>;
  getDustAddress?: () => Promise<string>;
  getUnshieldedAddress?: () => Promise<string>;
  getDustBalance?: () => Promise<{ balance?: bigint } | bigint>;
  balanceUnsealedTransaction: (
    tx: string,
    options?: { payFees?: boolean },
  ) => Promise<{ tx: string }>;
  submitTransaction: (tx: string) => Promise<void>;
  getProvingProvider?: (keys: {
    getZKIR: (loc: string) => Promise<Uint8Array>;
    getProverKey: (loc: string) => Promise<Uint8Array>;
    getVerifierKey: (loc: string) => Promise<Uint8Array>;
  }) => Promise<unknown>;
};

/** Base URL the page was served from (/apps/<id>), for keys and zkir. Never the origin root. */
export function assetBase(): string {
  return new URL('.', document.baseURI).href.replace(/\/$/, '');
}

export function applyNetworkId(cfg: MidnightConfig): MidnightConfig {
  setNetworkId(cfg.networkId);
  return cfg;
}

/** The project's network. Throws `network <status>` while it is starting or stopped. */
export async function loadMidnightConfig(): Promise<MidnightConfig> {
  const res = await fetch(new URL('midnight-config.json', document.baseURI));
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { status?: string };
    throw new Error(`network ${body.status ?? 'unavailable'}`);
  }
  return applyNetworkId(parseNetworkConfig(await res.text()));
}

export function importConfigFromText(text: string): MidnightConfig {
  const previous = loadSavedConfig();
  const cfg = applyNetworkId(parseNetworkConfig(text));
  saveConfig(cfg);
  if (nodeUrlChanged(previous, cfg)) {
    console.info(
      'Network endpoints changed. Re-sync the wallet Undeployed network and redeploy the contract.',
    );
  }
  return cfg;
}

/** Reads the clipboard. Throws ClipboardConfigError so the UI can show a paste box. */
export async function importConfigFromClipboard(): Promise<MidnightConfig> {
  let text: string;
  try {
    text = await navigator.clipboard.readText();
  } catch {
    throw new ClipboardConfigError();
  }
  return importConfigFromText(text);
}

/** Imported config first, then `./midnight-config.json` when the app is published. */
export async function resolveConfig(): Promise<MidnightConfig | null> {
  const saved = loadSavedConfig();
  if (saved) return applyNetworkId(saved);
  try {
    return await loadMidnightConfig();
  } catch {
    return null;
  }
}

export function connectExtension(
  wallet: DetectedWallet,
  networkId = 'undeployed',
): Promise<ConnectedWalletApi> {
  return wallet.api.connect(networkId) as Promise<ConnectedWalletApi>;
}

/** Genesis / fund / midnight-js — loaded only when Use test wallet or Fund runs. */
export async function connectGenesisWallet(
  cfg: MidnightConfig,
  seedHex?: string,
) {
  const m = await import('./studio-network-sdk');
  return m.connectGenesisWallet(cfg, seedHex);
}

export async function createProviders(
  cfg: MidnightConfig,
  wallet: Awaited<ReturnType<typeof connectGenesisWallet>>,
  privateStateProvider: unknown,
) {
  const m = await import('./studio-network-sdk');
  return m.createProviders(cfg, wallet, privateStateProvider);
}

export async function createProvidersFromWallet(
  cfg: MidnightConfig,
  api: ConnectedWalletApi,
  privateStateProvider: unknown,
) {
  const m = await import('./studio-network-sdk');
  return m.createProvidersFromWallet(cfg, api, privateStateProvider);
}

export async function fundWallet(
  cfg: MidnightConfig,
  addrs: { dustAddress: string; unshieldedAddress?: string },
) {
  const m = await import('./studio-network-sdk');
  return m.fundWallet(cfg, addrs);
}
