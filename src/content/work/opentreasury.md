---
lede: 'Infrastructure for public spending that anyone can check: the treasury keeps its database, and a shared ledger holds proof that the records were not rewritten.'
role: 'Founder, architecture and engineering'
facts:
  - { value: '2', label: 'Organisations must endorse every anchor' }
  - { value: '3', label: 'Independent verifiers: CLI, browser, phone' }
  - { value: '1', label: 'Command to run the whole stack' }
  - { value: 'v0.1.0', label: 'Feature complete' }
---

## The gap

Public money moves through finance systems the public never sees. What comes out the other end is a summary, published on the ministry's schedule in the ministry's format. If you want to confirm that the totals match the transactions underneath them, there is no mechanism for doing so.

OpenTreasury is my attempt at that mechanism.

## Why the blockchain is not the database

The obvious sketch puts the transactions on a chain. Three properties of treasury data rule that out:

- **Confidentiality.** Treasury records contain things that must never be public, and an on-chain record cannot be redacted later.
- **Change.** The data keeps changing shape as reconciliation runs.
- **Operations.** A working finance system needs migrations, reporting views and validation before anything is stored. Those are database properties.

So the job is split. **PostgreSQL is the system of record**: transactions, the double-entry core, commitments, reconciliation state. **Hyperledger Fabric has a much narrower role**: finalised events, reversals, corrections, document hashes and balance proofs. The payloads stay in Postgres. The chain holds evidence that they have not been altered.

## Mistakes are first-class

Real treasuries reverse transactions and fix errors. A transparency system that treats "immutable" as "never wrong" would be switched off in its first month. In OpenTreasury a reversal or a correction is an entry in the ledger like any other, anchored the same way. The record of an error is exactly as tamper-evident as the record of a correct entry, which is what an auditor actually needs.

## Nobody can rewrite history alone

Events are batched into Merkle trees and the roots are anchored on a network where the chaincode requires endorsement from two organisations: the treasury and the audit body. A chain run only by the institution being watched proves nothing, so that two-party rule is the entire reason Fabric is in the stack.

Verification does not depend on trusting the platform either. There are independent verifiers for the command line, the browser and mobile, and the mobile one checks a balance proof on the device, without asking the treasury's servers to vouch for the treasury.

## Meeting governments where they are

The first connector reads export files and maps them through YAML profiles. Government finance systems are varied and often old; an export file is the one integration surface you can count on. The price is latency, since file ingestion is batch by nature. For a transparency platform that trade is fine.

Who may see what, and what must be redacted before publishing, lives in Open Policy Agent policies rather than in conditionals scattered through the code, so those decisions can be reviewed and tested on their own.

## Where it stands

v0.1.0 is feature complete. The stack runs locally with one command and deploys to Kubernetes with Helm, with signed images. The repository includes a full white paper.
