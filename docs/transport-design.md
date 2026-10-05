# v0.4: give the experimenter control of delivery

The observatory made consensus visible and causal slices explained local decisions. A random-loss slider could not deliberately hold one acknowledgement until a newer one arrived, or show why three physical vote replies can represent only one voter.

This round adds a real message scheduler and two reproducible cases. The dark delivery board continues the observatory's visual language. Held rows use orange, live arrivals use cyan, and a lineage diagram connects original/copy records to one sender and receiver. Counts and decisions come from the engine. No traffic or vote is staged.

## Operations

| Operation | Result                                     | Protocol consequence                                |
| --------- | ------------------------------------------ | --------------------------------------------------- |
| Hold      | Removes one live schedule; retains payload | Timeouts and all other messages continue            |
| Release   | New scheduling identity at now + 1–5,000ms | Receiver/offline/connectivity checks still apply    |
| Duplicate | New physical packet, same complete RPC     | Same voter/request sequence; independent send fault |
| Discard   | Transport drop with manual cause           | Receiver is never invoked                           |

Unavailable IDs and invalid operations fail before history mutation. Thirty-two held messages and 6,000 actions bound memory/copies. Released old packets become inspectable even after earlier history eviction.

## Experiments

**Vote echo:** four real granted replies are held. One reply and two copies arrive. Self-vote plus that peer is 2/3, and both copies execute `duplicate-vote`. A distinct peer's reply reaches 3/3 and triggers leadership.

**Delayed acknowledgement:** hold a successful AppendResponse. Submit another entry and let newer responses confirm it. Release the old reply: `stale-rpc` preserves confirmed replication progress and all receiver state.

The vote scenario uses seed 7 and latency 10ms so initial requests arrive before another election timeout. This is a documented controlled schedule. Free experiments retain configurable timing and can produce competing candidates.

## Acceptance

1. Hold past its original deadline; no receiving branch runs until release.
2. Release to the original deadline; obsolete heap record stays invalid and delivery occurs once.
3. Three vote replies from one peer add only one independent voter; another peer causes election.
4. A newer confirmation followed by an old held reply cannot regress replication.
5. Released packets encounter directed cuts/offline receivers; manual discard invokes no receiver.
6. Held storage survives forensic-ring eviction; bounds/unavailable references reject atomically.
7. Export/import reconstructs complete snapshots. An invalid runtime packet reference preserves active state and original history.
8. Keyboard controls and proof fit 320/390/768/1440px in three browser engines.
9. One hundred combined-fault schedules converge after recovery and replay exactly, exercising every packet control.
10. The actual public revision and extracted portable ZIP run the new cases before release publication.

See [executed validation](validation.md), [architecture](architecture.md) and [fixtures](experiments/). Tests sample executions; they do not establish formal correctness or real-network durability.
