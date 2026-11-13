import type { MidnightProviders } from "@midnight-ntwrk/midnight-js-types";
import { type Ledger } from "@private-voting/contract";
import { type PrivateVotingPrivateState } from "@private-voting/contract/witnesses";
export type ImpureCircuitKeys = "registerToVote" | "openVoting" | "commitVote" | "closeVoting" | "revealVote" | "declareWinner";
export declare const PRIVATE_STATE_ID: "privateState";
export type ContractState = Ledger;
export type PrivateState = PrivateVotingPrivateState;
export interface DerivedState {
    contractState: ContractState | null;
    privateState: PrivateState | null;
}
export type AppProviders = MidnightProviders<ImpureCircuitKeys, typeof PRIVATE_STATE_ID, PrivateState>;
//# sourceMappingURL=types.d.ts.map