import { type Ledger, VoteChoice, type Witnesses } from './managed/private-voting/contract/index.js';
import { type WitnessContext } from '@midnight-ntwrk/midnight-js-protocol/compact-runtime';

export interface PrivateVotingPrivateState {
  localSk: Uint8Array;
  localVote: VoteChoice;
}

export const createPrivateVotingPrivateState = (
  localSk: Uint8Array,
  localVote: VoteChoice = VoteChoice.BAD
): PrivateVotingPrivateState => ({
  localSk,
  localVote,
});

export const witnesses: Witnesses<PrivateVotingPrivateState> = {
  localSk: ({ privateState }) => [privateState, privateState.localSk],
  localGetVote: ({ privateState }) => [privateState, privateState.localVote],
};

export type { Ledger, WitnessContext };
