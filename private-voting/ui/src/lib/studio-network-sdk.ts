// Loaded from studio-network.ts only when Use test wallet or Fund this wallet runs.
// Do not import this file from App.tsx or wallet-context at the top level.
import { Buffer } from 'buffer';
import {
  DustSecretKey,
  LedgerParameters,
  Transaction,
  ZswapSecretKeys,
  nativeToken,
} from '@midnight-ntwrk/ledger-v8';
import { FetchZkConfigProvider } from '@midnight-ntwrk/midnight-js-fetch-zk-config-provider';
import { httpClientProofProvider } from '@midnight-ntwrk/midnight-js-http-client-proof-provider';
import { indexerPublicDataProvider } from '@midnight-ntwrk/midnight-js-indexer-public-data-provider';
import { setNetworkId } from '@midnight-ntwrk/midnight-js-network-id';
import {
  fromHex,
  parseCoinPublicKeyToHex,
  parseEncPublicKeyToHex,
  toHex,
  ttlOneHour,
} from '@midnight-ntwrk/midnight-js-utils';
import {
  DustAddress,
  DustWallet,
  HDWallet,
  InMemoryTransactionHistoryStorage,
  MidnightBech32m,
  PublicKey,
  Roles,
  ShieldedWallet,
  UnshieldedAddress,
  UnshieldedWallet,
  WalletEntrySchema,
  WalletFacade,
  createKeystore,
  mergeWalletEntries,
  type FacadeState,
} from '@midnight-ntwrk/wallet-sdk';
import * as Rx from 'rxjs';
import {
  applyNetworkId,
  assetBase,
  type ConnectedWalletApi,
  type MidnightConfig,
} from './studio-network';

(globalThis as { Buffer?: unknown }).Buffer ??= Buffer;

const STAR_PER_NIGHT = 1_000_000n;
const SPONSOR_NIGHT = 100_000n * STAR_PER_NIGHT;
const WALLET_NIGHT = 1_000n * STAR_PER_NIGHT;
const FUND_TIMEOUT_MS = 180_000;

function deriveKey(seedHex: string, role: number): Uint8Array {
  const hd = HDWallet.fromSeed(Buffer.from(seedHex, 'hex'));
  if (hd.type !== 'seedOk') throw new Error('invalid wallet seed');
  const key = hd.hdWallet.selectAccount(0).selectRole(role).deriveKeyAt(0);
  if (key.type === 'keyOutOfBounds') throw new Error('key derivation out of bounds');
  return key.key;
}

const complete = (p: unknown) =>
  !!p &&
  typeof (p as { isStrictlyComplete?: unknown }).isStrictlyComplete === 'function' &&
  (p as { isStrictlyComplete: () => boolean }).isStrictlyComplete();

export type GenesisWallet = {
  facade: Awaited<ReturnType<typeof WalletFacade.init>>;
  provider: {
    getCoinPublicKey: () => unknown;
    getEncryptionPublicKey: () => unknown;
    balanceTx: (tx: never, ttl?: Date) => Promise<unknown>;
    submitTx: (tx: never) => Promise<unknown>;
  };
  state: FacadeState;
  keystore: ReturnType<typeof createKeystore>;
  zswapSecretKeys: ReturnType<typeof ZswapSecretKeys.fromSeed>;
  dustSecretKey: ReturnType<typeof DustSecretKey.fromSeed>;
};

/** Builds, starts and fully syncs a wallet from a genesis seed (cfg.wallets[0] by default). */
export async function connectGenesisWallet(
  cfg: MidnightConfig,
  seedHex = cfg.wallets[0].seed,
): Promise<GenesisWallet> {
  const shieldedSeed = deriveKey(seedHex, Roles.Zswap);
  const unshieldedSeed = deriveKey(seedHex, Roles.NightExternal);
  const dustSeed = deriveKey(seedHex, Roles.Dust);
  const config = {
    indexerClientConnection: { indexerHttpUrl: cfg.indexer, indexerWsUrl: cfg.indexerWS },
    provingServerUrl: new URL(cfg.proofServer),
    networkId: cfg.networkId,
    relayURL: new URL(cfg.nodeWS),
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
    costParameters: { feeBlocksMargin: 5 },
  };
  const keystore = createKeystore(unshieldedSeed, cfg.networkId as never);
  const shielded = ShieldedWallet(config as never).startWithSeed(shieldedSeed);
  const unshielded = UnshieldedWallet({
    ...config,
    txHistoryStorage: new InMemoryTransactionHistoryStorage(WalletEntrySchema, mergeWalletEntries),
  } as never).startWithPublicKey(PublicKey.fromKeyStore(keystore));
  const dust = DustWallet({
    ...config,
    costParameters: {
      ledgerParams: LedgerParameters.initialParameters(),
      additionalFeeOverhead: 1_000n,
      feeBlocksMargin: 5,
    },
  } as never).startWithSeed(dustSeed, LedgerParameters.initialParameters().dust);
  const facade = await WalletFacade.init({
    configuration: config as never,
    shielded: () => shielded,
    unshielded: () => unshielded,
    dust: () => dust,
  } as never);
  const zswapSecretKeys = ZswapSecretKeys.fromSeed(shieldedSeed);
  const dustSecretKey = DustSecretKey.fromSeed(dustSeed);
  await facade.start(zswapSecretKeys, dustSecretKey);
  const synced: FacadeState = await Rx.firstValueFrom(
    facade
      .state()
      .pipe(
        Rx.filter(
          (s) =>
            complete(s.shielded.state.progress) &&
            complete(s.unshielded.progress) &&
            complete(s.dust.state.progress),
        ),
      ),
  );

  const provider = {
    getCoinPublicKey: () => zswapSecretKeys.coinPublicKey,
    getEncryptionPublicKey: () => zswapSecretKeys.encryptionPublicKey,
    async balanceTx(tx: never, ttl: Date = ttlOneHour()) {
      const recipe = await facade.balanceUnboundTransaction(
        tx,
        { shieldedSecretKeys: zswapSecretKeys, dustSecretKey },
        { ttl },
      );
      const signed = await facade.signRecipe(recipe, (payload: Uint8Array) => keystore.signData(payload));
      return facade.finalizeRecipe(signed);
    },
    submitTx: (tx: never) => facade.submitTransaction(tx),
  };
  return { facade, provider, state: synced, keystore, zswapSecretKeys, dustSecretKey };
}

/** midnight-js providers wired to the project's network; pass your own private state provider. */
export function createProviders(
  cfg: MidnightConfig,
  wallet: Awaited<ReturnType<typeof connectGenesisWallet>>,
  privateStateProvider: unknown,
) {
  const zkConfigProvider = new FetchZkConfigProvider(assetBase(), fetch.bind(window));
  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(cfg.indexer, cfg.indexerWS, WebSocket as never),
    zkConfigProvider,
    proofProvider: httpClientProofProvider(cfg.proofServer, zkConfigProvider),
    walletProvider: wallet.provider,
    midnightProvider: wallet.provider,
  } as never;
}

async function fetchKeyBytes(loc: string): Promise<Uint8Array> {
  return new Uint8Array(await (await fetch(loc)).arrayBuffer());
}

async function proofProviderFromWallet(
  api: ConnectedWalletApi,
  cfg: MidnightConfig,
  zkConfigProvider: FetchZkConfigProvider<string>,
) {
  try {
    if (typeof api.getProvingProvider === 'function') {
      const proving = await api.getProvingProvider({
        getZKIR: fetchKeyBytes,
        getProverKey: fetchKeyBytes,
        getVerifierKey: fetchKeyBytes,
      });
      if (proving) return proving;
    }
  } catch {
    /* wallet proving unavailable — use the project's proof server */
  }
  return httpClientProofProvider(cfg.proofServer, zkConfigProvider);
}

/**
 * Providers for a connected extension. Indexer and node come from the wallet;
 * proving uses getProvingProvider, falling back to cfg.proofServer.
 */
export async function createProvidersFromWallet(
  cfg: MidnightConfig,
  api: ConnectedWalletApi,
  privateStateProvider: unknown,
) {
  const walletCfg = await api.getConfiguration();
  setNetworkId(walletCfg.networkId ?? cfg.networkId);
  const zkConfigProvider = new FetchZkConfigProvider(assetBase(), fetch.bind(window));
  const { shieldedCoinPublicKey, shieldedEncryptionPublicKey } = await api.getShieldedAddresses();
  const networkId = walletCfg.networkId ?? cfg.networkId;
  const coinPublicKey = parseCoinPublicKeyToHex(shieldedCoinPublicKey, networkId as never);
  const encryptionPublicKey = parseEncPublicKeyToHex(
    shieldedEncryptionPublicKey,
    networkId as never,
  );
  return {
    privateStateProvider,
    publicDataProvider: indexerPublicDataProvider(
      walletCfg.indexerUri,
      walletCfg.indexerWsUri ?? cfg.indexerWS,
      WebSocket as never,
    ),
    zkConfigProvider,
    proofProvider: await proofProviderFromWallet(api, cfg, zkConfigProvider),
    walletProvider: {
      getCoinPublicKey: () => coinPublicKey,
      getEncryptionPublicKey: () => encryptionPublicKey,
      balanceTx: async (tx: { serialize: () => Uint8Array }, _ttl?: Date) => {
        const { tx: balancedHex } = await api.balanceUnsealedTransaction(toHex(tx.serialize()), {});
        return Transaction.deserialize('signature', 'proof', 'binding', fromHex(balancedHex));
      },
    },
    midnightProvider: {
      submitTx: async (tx: { serialize: () => Uint8Array; identifiers: () => string[] }) => {
        await api.submitTransaction(toHex(tx.serialize()));
        const [txId] = tx.identifiers();
        if (!txId) throw new Error('Submitted transaction has no identifier');
        return txId;
      },
    },
  } as never;
}

async function sponsorSeedHex(dust: string): Promise<string> {
  const bytes = new TextEncoder().encode(`mn-examples fund:wallet sponsor for ${dust}`);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function nightCoinCount(state: {
  unshielded: { availableCoins: ReadonlyArray<{ utxo: { type: string } }> };
}): number {
  const night = nativeToken().raw;
  return state.unshielded.availableCoins.filter((c) => c.utxo.type === night).length;
}

async function transferNight(
  w: GenesisWallet,
  to: InstanceType<typeof UnshieldedAddress>,
  amount: bigint,
): Promise<string> {
  const recipe = await w.facade.transferTransaction(
    [{ type: 'unshielded', outputs: [{ type: nativeToken().raw, receiverAddress: to, amount }] }],
    { shieldedSecretKeys: w.zswapSecretKeys, dustSecretKey: w.dustSecretKey },
    { ttl: ttlOneHour() },
  );
  const signed = await w.facade.signRecipe(recipe, (payload: Uint8Array) =>
    w.keystore.signData(payload),
  );
  return w.facade.submitTransaction(await w.facade.finalizeRecipe(signed));
}

async function registerNightForDust(
  w: GenesisWallet,
  dustReceiver: InstanceType<typeof DustAddress>,
): Promise<string | null> {
  const state = await w.facade.waitForSyncedState();
  const night = nativeToken().raw;
  const unregistered = state.unshielded.availableCoins.filter(
    (coin: { utxo: { type: string }; meta: { registeredForDustGeneration: boolean } }) =>
      coin.utxo.type === night && coin.meta.registeredForDustGeneration === false,
  );
  if (unregistered.length === 0) return null;
  const recipe = await w.facade.registerNightUtxosForDustGeneration(
    unregistered,
    w.keystore.getPublicKey(),
    (payload: Uint8Array) => w.keystore.signData(payload),
    dustReceiver,
  );
  return w.facade.submitTransaction(await w.facade.finalizeRecipe(recipe));
}

/**
 * Genesis-sponsor funding for a new Lace/1AM wallet (0 DUST). Never re-registers Alice's NIGHT.
 * Sends 1,000 NIGHT to `unshieldedAddress` when given.
 */
export async function fundWallet(
  cfg: MidnightConfig,
  addrs: { dustAddress: string; unshieldedAddress?: string },
): Promise<void> {
  applyNetworkId(cfg);
  const dustReceiver = MidnightBech32m.parse(addrs.dustAddress).decode(
    DustAddress,
    cfg.networkId as never,
  );
  const nightRecipient = addrs.unshieldedAddress
    ? MidnightBech32m.parse(addrs.unshieldedAddress).decode(UnshieldedAddress, cfg.networkId as never)
    : null;
  const alice = await connectGenesisWallet(cfg);
  const sponsor = await connectGenesisWallet(cfg, await sponsorSeedHex(addrs.dustAddress));
  try {
    if (nightCoinCount(sponsor.state) === 0) {
      const sponsorAddress = await sponsor.facade.unshielded.getAddress();
      await transferNight(alice, sponsorAddress, SPONSOR_NIGHT);
      await Rx.firstValueFrom(
        sponsor.facade.state().pipe(
          Rx.filter((s) => nightCoinCount(s) > 0),
          Rx.take(1),
          Rx.timeout({
            each: FUND_TIMEOUT_MS,
            with: () => Rx.throwError(() => new Error('sponsor did not receive NIGHT')),
          }),
        ),
      );
      await registerNightForDust(sponsor, dustReceiver);
    }
    if (nightRecipient) {
      await alice.facade.waitForSyncedState();
      await transferNight(alice, nightRecipient, WALLET_NIGHT);
    }
  } finally {
    await sponsor.facade.stop().catch(() => undefined);
    await alice.facade.stop().catch(() => undefined);
  }
}
