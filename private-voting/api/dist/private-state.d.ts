import type { PrivateStateProvider } from "@midnight-ntwrk/midnight-js-types";
/**
 * Session-scoped, in-memory implementation of the full PrivateStateProvider
 * interface. Browser DApps cannot use LevelDB, so private state and signing
 * keys live in plain Maps for the lifetime of the page.
 *
 * This implements the complete 13-method PrivateStateProvider<PSI, PS>
 * contract. The export/import methods are not meaningful for an ephemeral
 * in-memory store, so they reject — swap in an encrypting persistent provider
 * (e.g. IndexedDB) if you need cross-session private state or real exports.
 */
export declare function inMemoryPrivateStateProvider<PSI extends string, PS>(): PrivateStateProvider<PSI, PS>;
//# sourceMappingURL=private-state.d.ts.map