import type { ChargedState } from "@midnight-ntwrk/compact-runtime";
import type { ConnectedAPI } from "@midnight-ntwrk/dapp-connector-api";
import { Observable } from "rxjs";
import type { AppProviders, ContractState, DerivedState } from "./types.js";
export { inMemoryPrivateStateProvider } from "./private-state.js";
export type { AppProviders, ContractState, DerivedState, ImpureCircuitKeys, PrivateState, } from "./types.js";
export { PRIVATE_STATE_ID } from "./types.js";
export declare function createProviders(api: ConnectedAPI): Promise<AppProviders>;
export declare function deploy(providers: AppProviders, candidate0: string, candidate1: string): Promise<{
    address: string;
}>;
export declare function join(providers: AppProviders, contractAddress: string): Promise<any>;
export declare function createStateObservable(publicDataProvider: AppProviders["publicDataProvider"], privateStateProvider: AppProviders["privateStateProvider"], contractAddress: string, parseLedger: (data: ChargedState) => ContractState): Observable<DerivedState>;
//# sourceMappingURL=index.d.ts.map