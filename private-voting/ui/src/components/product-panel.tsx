import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { useMidnightProviders } from "@/providers/midnight-providers";
import { deploy, join, createStateObservable } from "private-voting-api";
import { VoteChoice, VotingState } from "@private-voting/contract";
import { useContractState } from "@/hooks/use-contract-state";

export function ProductPanel() {
  const { status, mode } = useWallet();
  const { providers, error: providersError } = useMidnightProviders();
  const ready = status === "connected" && providers != null;

  const [contractAddress, setContractAddress] = useState<string>("");
  const [candidate0Input, setCandidate0Input] = useState<string>("Candidate A");
  const [candidate1Input, setCandidate1Input] = useState<string>("Candidate B");
  const [activeContract, setActiveContract] = useState<any | null>(null);
  const [activeAddress, setActiveAddress] = useState<string>("");
  const [txLoading, setTxLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedVote, setSelectedVote] = useState<VoteChoice>(VoteChoice.BAD);

  // Subscribe to contract state updates
  const [stateObservable, setStateObservable] = useState<any | null>(null);
  const { state: contractState } = useContractState<any>(stateObservable);

  useEffect(() => {
    if (activeAddress && providers) {
      const obs = createStateObservable(
        providers.publicDataProvider,
        providers.privateStateProvider,
        activeAddress,
        (data: any) => data
      );
      setStateObservable(obs);
    } else {
      setStateObservable(null);
    }
  }, [activeAddress, providers]);

  if (!ready) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Private Voting</CardTitle>
          <CardDescription>
            Import network config and connect your wallet to start.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const handleDeploy = async () => {
    setTxLoading(true);
    setError(null);
    try {
      const res = await deploy(providers, candidate0Input, candidate1Input);
      setActiveAddress(res.address);
      const joined = await join(providers, res.address);
      setActiveContract(joined);
    } catch (err: any) {
      setError(err?.message ?? "Deployment failed");
    } finally {
      setTxLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!contractAddress) return;
    setTxLoading(true);
    setError(null);
    try {
      const joined = await join(providers, contractAddress);
      setActiveContract(joined);
      setActiveAddress(contractAddress);
    } catch (err: any) {
      setError(err?.message ?? "Failed to join contract");
    } finally {
      setTxLoading(false);
    }
  };

  const callCircuit = async (circuitName: string, ...args: any[]) => {
    if (!activeContract) return;
    setTxLoading(true);
    setError(null);
    try {
      // Update local private state vote choice before committing/revealing
      if (circuitName === "commitVote" || circuitName === "revealVote") {
        const ps = await providers.privateStateProvider.get("privateState");
        if (ps) {
          ps.localVote = selectedVote;
          await providers.privateStateProvider.set("privateState", ps);
        }
      }

      const tx = await activeContract.callTx[circuitName](...args);
      console.log(`${circuitName} tx submitted:`, tx);
    } catch (err: any) {
      setError(err?.message ?? `Circuit ${circuitName} call failed`);
    } finally {
      setTxLoading(false);
    }
  };

  const ledger = contractState?.contractState;

  return (
    <div className="flex flex-col gap-4">
      {providersError ? (
        <p className="text-sm text-destructive">{providersError}</p>
      ) : null}

      {!activeAddress ? (
        <Card>
          <CardHeader>
            <CardTitle>Deploy or Join Election</CardTitle>
            <CardDescription>
              Start a new private election or connect to an existing contract on undeployed network.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 border-b pb-4">
              <h3 className="font-semibold text-sm">Deploy New Election</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={candidate0Input}
                  onChange={(e) => setCandidate0Input(e.target.value)}
                  placeholder="Candidate A name"
                  className="border p-2 rounded text-sm flex-1"
                />
                <input
                  type="text"
                  value={candidate1Input}
                  onChange={(e) => setCandidate1Input(e.target.value)}
                  placeholder="Candidate B name"
                  className="border p-2 rounded text-sm flex-1"
                />
              </div>
              <Button onClick={handleDeploy} disabled={txLoading}>
                {txLoading ? "Deploying..." : "Deploy Election Contract"}
              </Button>
            </div>

            <div className="flex flex-col gap-2">
              <h3 className="font-semibold text-sm">Join Existing Election</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={contractAddress}
                  onChange={(e) => setContractAddress(e.target.value)}
                  placeholder="0x..."
                  className="border p-2 rounded text-sm flex-1"
                />
                <Button onClick={handleJoin} disabled={txLoading || !contractAddress}>
                  Join
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Private Election Dashboard</CardTitle>
            <CardDescription className="font-mono text-xs">
              Address: {activeAddress}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            {ledger ? (
              <div className="grid grid-cols-2 gap-2 border-b pb-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Voting State:</span>
                  <span className="ml-2 font-bold">
                    {VotingState[ledger.votingState]}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Registered:</span>
                  <span className="ml-2 font-bold">
                    {Number(ledger.registeredVoters?.size?.() ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Votes Committed:</span>
                  <span className="ml-2 font-bold">
                    {Number(ledger.totalVoteCount ?? 0)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Votes Revealed:</span>
                  <span className="ml-2 font-bold">
                    {Number(ledger.revealedVoters?.size?.() ?? 0)}
                  </span>
                </div>
                <div className="col-span-2 pt-2 border-t mt-2">
                  <div className="font-semibold">Candidate Standings:</div>
                  <div className="flex justify-between mt-1">
                    <span>{ledger.candidate0}: {Number(ledger.candidate0VoteCount ?? 0)} votes</span>
                    <span>{ledger.candidate1}: {Number(ledger.candidate1VoteCount ?? 0)} votes</span>
                  </div>
                </div>
                {ledger.winner !== VoteChoice.TIE && (
                  <div className="col-span-2 mt-2 bg-primary/10 p-2 rounded text-center font-bold text-primary">
                    Winner: {ledger.winner === VoteChoice.BAD ? ledger.candidate0 : ledger.candidate1}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Loading ledger state...</p>
            )}

            {error ? <p className="text-sm text-destructive">{error}</p> : null}

            {ledger && (
              <div className="flex flex-col gap-3">
                {ledger.votingState === VotingState.CLOSED && (
                  <>
                    <Button onClick={() => callCircuit("registerToVote")} disabled={txLoading}>
                      Register to Vote
                    </Button>
                    <Button onClick={() => callCircuit("openVoting")} disabled={txLoading} variant="outline">
                      Open Voting (Organizer Only)
                    </Button>
                  </>
                )}

                {ledger.votingState === VotingState.OPEN && (
                  <div className="flex flex-col gap-2 border p-3 rounded">
                    <h4 className="font-semibold text-sm">Cast Anonymous Vote</h4>
                    <div className="flex gap-4 my-2">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="vote"
                          checked={selectedVote === VoteChoice.BAD}
                          onChange={() => setSelectedVote(VoteChoice.BAD)}
                        />
                        {ledger.candidate0}
                      </label>
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="radio"
                          name="vote"
                          checked={selectedVote === VoteChoice.WORSE}
                          onChange={() => setSelectedVote(VoteChoice.WORSE)}
                        />
                        {ledger.candidate1}
                      </label>
                    </div>
                    <Button onClick={() => callCircuit("commitVote")} disabled={txLoading}>
                      Submit Private Vote Commitment
                    </Button>
                    <Button onClick={() => callCircuit("closeVoting")} disabled={txLoading} variant="outline" className="mt-2">
                      Close Voting (Organizer Only)
                    </Button>
                  </div>
                )}

                {ledger.votingState === VotingState.CLOSED && Number(ledger.totalVoteCount ?? 0) > 0 && (
                  <div className="flex flex-col gap-2 border p-3 rounded">
                    <h4 className="font-semibold text-sm">Reveal & Tally Vote</h4>
                    <Button onClick={() => callCircuit("revealVote")} disabled={txLoading}>
                      Reveal Vote Choice
                    </Button>
                    <Button onClick={() => callCircuit("declareWinner")} disabled={txLoading} variant="outline" className="mt-2">
                      Declare Winner (Organizer Only)
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
