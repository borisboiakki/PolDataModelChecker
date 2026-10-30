# dmCheck test structure (spike T4)

Invented structure that exercises every v1 check of dmCheck with known results. It is the regression set of the
harness (`tools/vtest/dmCheck/`) and can be created in the PO's sandbox project to compare dmCheck on 2512 with the
expected violations below (`docs/PO_CHECKS.md` §3). Model: `model.yaml` (same folder).

Work item types used: `customerRequirement`, `requirement`, `testCase`, `heading`, plus `information` (a type that the
model does not list for the customer specification). Link roles: `satisfies`, `verifies`, `parent`. Ids below are
placeholders: Polarion gives its own ids; keep the titles to recognise the items.

## Documents and items (link = stored on the item of the row, pointing to the target)

| Document | Item (title) | Type | Links |
|---|---|---|---|
| Specs/Customer Specification | CUS-1 | heading | |
| | CUS-2 | customerRequirement | |
| | CUS-3 | customerRequirement | |
| | CUS-4 | customerRequirement | |
| | CUS-5 | customerRequirement | |
| | CUS-6 | information | |
| Specs/Solution Spec A | SPA-1 | heading | |
| | SPA-2 | requirement | satisfies CUS-2 |
| | SPA-3 | requirement | satisfies CUS-3 |
| | SPA-4 | requirement | |
| | SPA-5 | requirement | satisfies CUS-3; parent SPA-2 |
| Specs/Solution Spec B | SPB-1 | requirement | satisfies CUS-4 |
| | SPB-2 | requirement | satisfies CUS-4 |
| | SPB-3 | requirement | satisfies SPA-2 |
| Tests/STD A | STA-1 | testCase | verifies SPA-2 |
| | STA-2 | testCase | verifies SPA-3 |
| | STA-3 | testCase | verifies SPB-1 |
| | STA-4 | testCase | |
| Tests/STD B | STB-1 | testCase | verifies SPB-1 |
| | STB-2 | testCase | verifies SPB-2 |

## Expected violations (11)

| # | Check | Rule | Severity | Document | Item | Why |
|---|---|---|---|---|---|---|
| 1 | Unexpected type | types CustomerSpec | error | Customer Specification | CUS-6 | `information` is not listed in the role |
| 2 | Missing link (from) | L1 | error | Solution Spec A | SPA-4 | satisfies no customer requirement |
| 3 | Missing link (from) | L1 | error | Solution Spec B | SPB-3 | its satisfies link goes to a solution requirement, not to the customer specification |
| 4 | Not covered (to) | L1 | error | Customer Specification | CUS-5 | satisfied by no solution requirement |
| 5 | Not covered (to) | L2 | warning | Solution Spec A | SPA-4 | verified by no test case of STD A |
| 6 | Not covered (to) | L2 | warning | Solution Spec A | SPA-5 | verified by no test case of STD A |
| 7 | Not covered (to) | L2 | warning | Solution Spec B | SPB-3 | verified by no test case of STD B |
| 8 | Missing link (from) | L2 | warning | STD A | STA-3 | its only link goes to Solution Spec B (not its pair) |
| 9 | Missing link (from) | L2 | warning | STD A | STA-4 | verifies nothing |
| 10 | Cross-pair link | L2 | warning | STD A | STA-3 | verifies SPB-1: STD A is paired with Solution Spec A |
| 11 | Unexpected link | — | warning | Solution Spec B | SPB-3 | satisfies SPA-2: no rule SolutionSpec satisfies SolutionSpec |

Compliant on purpose: SPB-1 is verified by STB-1 (the cross-pair link of STA-3 does not count, but is not needed);
SPA-5 → SPA-2 `parent` matches P1; the headings are ignored; every document has its required types; no unpaired
document.

Counters (checked / compliant): L1 from 7 / 5, L1 to 4 / 3, L2 from 6 / 4, L2 to 7 / 4, P1 (no minimum) —.
