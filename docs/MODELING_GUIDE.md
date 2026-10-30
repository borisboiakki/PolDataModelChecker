# Modelling guide: writing a data model, with examples

This guide shows how to describe common project structures in the data model YAML read by **dmDefine** (shows and
validates the model) and **dmCheck** (checks the real data against it). The full format, keys and defaults are in
[DATA_MODEL_FORMAT.md](DATA_MODEL_FORMAT.md); how to install the widget and where to paste the model is in
[dmDefine/install.md](dmDefine/install.md).

You can write the YAML by hand, or use **Edit model** in dmDefine (0.3.0): forms with search-and-pick lists of the
project's types, link roles and documents, which generate the YAML to copy into the model work item.

All type, link role and document names below are invented: replace them with the ones of your project (dmDefine
reports a type, a link role or a document that does not exist).

**Status of the features used here**

| Feature | dmDefine (show, validate) | dmCheck (check the data) |
|---|---|---|
| Roles, item types, link rules, `from_min` / `to_min`, bindings, several documents per role (pooled) | since 0.1.0 | planned (0.1.0) |
| `uses:` (one model for several projects, use case 7), documents of other projects | since 0.4.0 | planned (0.1.0) |
| `pairs:` (paired documents, use cases 3 and 4) | since 0.2.0 (0.1.0 ignored it with the warning "Unknown key pairs (ignored)") | planned (0.1.0) |

dmCheck is not built yet: the "dmCheck reports" parts below describe what it will check.

## How to read a link rule

A link rule describes links of one link role between the items of two document roles, in the direction Polarion
stores them: `from` is the item that holds the link (the source), `to` is the item it points to (the target). For
`satisfies`, the downstream requirement holds the link and points to the upstream requirement.

```yaml
    - id: L1
      from: { role: SystemSpec, type: systemRequirement }      # source: holds the link
      link_role: satisfies
      to: { role: CustomerSpec, type: customerRequirement }    # target
      from_min: 1     # each system requirement satisfies at least 1 customer requirement ("traceability")
      to_min: 1       # each customer requirement is satisfied by at least 1 system requirement ("coverage")
      severity: error
```

| Setting | dmCheck reports |
|---|---|
| `from_min: n` | every source item (here: system requirement) with fewer than n such links |
| `to_min: n` | every target item (here: customer requirement) with fewer than n such links |
| both 0 (or omitted) | nothing missing; the rule only says that these links are **allowed** |
| `model.unexpected_links` (not `ignore`) | links of a link role used by the model, between declared documents, that match no rule (wrong direction, wrong role or type) |

In the dmDefine graph the arrow follows the link (source → target) and the target role is on the left.

## Use case 1 — a simple V-cycle chain (one document per role)

A customer specification, a system specification that satisfies it, and a test specification that verifies the
system requirements.

```yaml
version: 1
name: Simple V-cycle

model:
  roles:
    CustomerSpec:
      title: Customer specification
      items:
        - { type: customerRequirement, min: 1 }
        - { type: heading, ignored: true }
    SystemSpec:
      title: System specification
      items:
        - { type: systemRequirement, min: 1 }
        - { type: heading, ignored: true }
    SystemTest:
      title: System test specification
      items:
        - { type: testCase, min: 1 }
  links:
    - id: L1
      from: { role: SystemSpec, type: systemRequirement }
      link_role: satisfies
      to: { role: CustomerSpec, type: customerRequirement }
      from_min: 1
      to_min: 1
    - id: L2
      from: { role: SystemTest, type: testCase }
      link_role: verifies
      to: { role: SystemSpec, type: systemRequirement }
      from_min: 1
      to_min: 1
      severity: warning
  unexpected_links: warning

bindings:
  CustomerSpec: ["Specs/Customer Specification"]
  SystemSpec: ["Specs/System Specification"]
  SystemTest: ["Tests/System Test Specification"]
```

dmCheck reports, for example: *customer requirement CUS-12 is satisfied by no system requirement (L1)*, *test case
TST-40 verifies no system requirement (L2)*, *test case TST-41 satisfies a customer requirement (unexpected link)*.

## Use case 2 — several documents per role, pooled (default)

Three system specifications play the role *system specification* and two test documents play the role *test
specification*. It does not matter which test document verifies which specification: every system requirement must be
verified by a test case of **any** test document. Nothing special to write: list the documents in `bindings`.

```yaml
version: 1
name: Pooled documents

model:
  roles:
    SystemSpec:
      title: System specification
      items:
        - { type: systemRequirement, min: 1 }
    SystemTest:
      title: Test specification
      items:
        - { type: testCase, min: 1 }
  links:
    - id: L1
      from: { role: SystemTest, type: testCase }
      link_role: verifies
      to: { role: SystemSpec, type: systemRequirement }
      from_min: 1
      to_min: 1

bindings:
  SystemSpec: ["Specs/System Spec 1", "Specs/System Spec 2", "Specs/System Spec 3"]
  SystemTest: ["Tests/Test Spec A", "Tests/Test Spec B"]
```

dmCheck checks (pooled):
- `to_min: 1`: each requirement of System Spec 1, 2 and 3 is verified by at least one test case of Test Spec A **or** B;
- `from_min: 1`: each test case of Test Spec A and B verifies at least one requirement of System Spec 1, 2 **or** 3;
- the violations are still listed per document (e.g. *System Spec 2: 4 requirements not verified*).

It does **not** check that a given test document covers a given specification: for that, use pairs (use case 3).

## Use case 3 — paired documents: each specification has its own test specification

A customer specification is satisfied by two solution specifications. Each solution specification must be verified by
**its own** test specification (STD): STD A verifies Solution Spec A, STD B verifies Solution Spec B. The `satisfies`
rule stays pooled (both solution specifications satisfy the one customer specification); the `verifies` rule is paired.

```yaml
version: 1
name: Solutions with their own STD

model:
  roles:
    CustomerSpec:
      title: Customer specification
      items:
        - { type: customerRequirement, min: 1 }
    SolutionSpec:
      title: Solution specification
      items:
        - { type: requirement, min: 1 }
    SolutionSTD:
      title: Solution test description
      items:
        - { type: testCase, min: 1 }
  links:
    - id: L1
      from: { role: SolutionSpec, type: requirement }
      link_role: satisfies
      to: { role: CustomerSpec, type: customerRequirement }
      from_min: 1
      to_min: 1
    - id: L2
      from: { role: SolutionSTD, type: testCase }
      link_role: verifies
      to: { role: SolutionSpec, type: requirement }
      from_min: 1
      to_min: 1

bindings:
  CustomerSpec: ["Specs/Customer Specification"]
  SolutionSpec: ["Specs/Solution Spec A", "Specs/Solution Spec B"]
  SolutionSTD: ["Tests/STD A", "Tests/STD B"]

pairs:
  L2:                                    # only the verifies rule is paired; L1 stays pooled
    - ["Tests/STD A", "Specs/Solution Spec A"]
    - ["Tests/STD B", "Specs/Solution Spec B"]
```

Each pair is written `[source document, target document]`: the document of the `from` role (here the STD, which holds
the `verifies` links) first, then the document of the `to` role.

dmDefine checks the pairs: a pair written the wrong way round (`["Specs/Solution Spec A", "Tests/STD A"]`) is an error
(*Specs/Solution Spec A is not declared in bindings for role SolutionSTD*), and a declared document in no pair is a
warning. The rule details, the table view and the Excel export (sheet *Document pairs*) list the pairs; a rule without
pairs is shown as *pooled*.

dmCheck checks for L2 (paired):
- `to_min: 1`: each requirement of Solution Spec A is verified by a test case of **STD A** (a test case of STD B does
  not count), and the same for B;
- `from_min: 1`: each test case of STD A verifies a requirement of Solution Spec A;
- **cross-pair link**: a test case of STD A that verifies a requirement of Solution Spec B is reported;
- **unpaired document**: a solution specification or an STD declared in `bindings` but in no pair is reported
  (e.g. *Solution Spec C has no paired SolutionSTD document for L2*).

And for L1 (pooled): each customer requirement is satisfied by a requirement of Solution Spec A or B.

## Use case 4 — one test document for two specifications (pairs, many-to-many)

A document may appear in several pairs. Here one STD verifies both solution specifications, a second STD verifies only
Solution Spec B:

```yaml
pairs:
  L2:
    - ["Tests/STD Common", "Specs/Solution Spec A"]
    - ["Tests/STD Common", "Specs/Solution Spec B"]
    - ["Tests/STD B Extra", "Specs/Solution Spec B"]
```

A requirement of Solution Spec B is covered by a test case of STD Common or STD B Extra; a test case of STD B Extra
that verifies a requirement of Solution Spec A is a cross-pair link.

## Use case 5 — the same check without pairs: one role per document (works today)

If you prefer to see each pair as separate boxes in the graph, give each document its
own role and repeat the rule per pair. The graph shows the pairs explicitly; the price is one rule per pair.

```yaml
version: 1
name: One role per document

model:
  roles:
    CustomerSpec:
      items:
        - { type: customerRequirement, min: 1 }
    SolutionSpecA:
      items:
        - { type: requirement, min: 1 }
    SolutionSpecB:
      items:
        - { type: requirement, min: 1 }
    STDA:
      items:
        - { type: testCase, min: 1 }
    STDB:
      items:
        - { type: testCase, min: 1 }
  links:
    - id: L1A
      from: { role: SolutionSpecA, type: requirement }
      link_role: satisfies
      to: { role: CustomerSpec, type: customerRequirement }
      from_min: 1
    - id: L1B
      from: { role: SolutionSpecB, type: requirement }
      link_role: satisfies
      to: { role: CustomerSpec, type: customerRequirement }
      from_min: 1
    - id: L2A
      from: { role: STDA, type: testCase }
      link_role: verifies
      to: { role: SolutionSpecA, type: requirement }
      from_min: 1
      to_min: 1
    - id: L2B
      from: { role: STDB, type: testCase }
      link_role: verifies
      to: { role: SolutionSpecB, type: requirement }
      from_min: 1
      to_min: 1
  unexpected_links: error              # a test case of STD A verifying Solution Spec B matches no rule

bindings:
  CustomerSpec: ["Specs/Customer Specification"]
  SolutionSpecA: ["Specs/Solution Spec A"]
  SolutionSpecB: ["Specs/Solution Spec B"]
  STDA: ["Tests/STD A"]
  STDB: ["Tests/STD B"]
```

Note: "each customer requirement is satisfied by A **or** B" (pooled coverage) cannot be written this way: `to_min` on
L1A alone would require coverage by A. Use case 3 expresses both needs in one model.

## Use case 6 — links inside one document role, and allowed links

A hierarchy inside the specification (`has parent` between requirements of the same role), and links that are allowed
but not required (both minimums 0). With `unexpected_links: warning`, any other link of `has parent`, `refines` or
`satisfies` between the declared documents is reported.

```yaml
version: 1
name: Hierarchy and allowed links

model:
  roles:
    SystemSpec:
      items:
        - { type: systemRequirement, min: 1 }
        - { type: heading, ignored: true }
    SubsystemSpec:
      items:
        - { type: subsystemRequirement, min: 1 }
  links:
    - id: P1
      from: { role: SystemSpec, type: systemRequirement }
      link_role: parent
      to: { role: SystemSpec, type: systemRequirement }
    - id: L1
      from: { role: SubsystemSpec, type: subsystemRequirement }
      link_role: satisfies
      to: { role: SystemSpec, type: systemRequirement }
      from_min: 1
    - id: R1
      from: { role: SubsystemSpec, type: subsystemRequirement }
      link_role: refines
      to: { role: SubsystemSpec, type: subsystemRequirement }
  unexpected_links: warning

bindings:
  SystemSpec: ["Specs/System Specification"]
  SubsystemSpec: ["Specs/Subsystem Specification"]
```

In the dmDefine graph, P1 and R1 are listed in the role boxes (loop sign), L1 is drawn as a line.

## Use case 7 — one model for several projects (`uses:`)

The roles and rules are written once, in a model work item of a central project (here `SYSENG/SE-12`, written like
use case 1, its own `bindings` are ignored). Each project that follows this model has a small model item that names the
central one and lists its own documents (and pairs). Changing the central model changes it for every project; the
widget shows "roles and rules from SYSENG/SE-12 (revision …)" and a link to open it.

```yaml
# Local part: the roles and rules come from the central model
version: 1
name: V-cycle of project B
uses: "SYSENG/SE-12"

bindings:
  CustomerSpec: ["Specs/Customer Specification"]
  SystemSpec: ["Specs/System Specification", "SYSENG/Specs/Common System Specification"]
  SystemTest: ["Tests/System Test Specification"]
```

- Only one level: the central model must not itself `use` another model, and the local item must not have a
  `model:` part.
- The types and link roles of the central model must exist in each project (dmDefine checks them against the project
  where the widget runs).
- A document of another project is written `project/space/name` (here `SYSENG/Specs/Common System Specification`).
- In *Edit model*, the roles and rules are read only; documents and pairs are edited, and *Generate YAML* keeps
  `uses:`. On an empty model, fill *Reuse the roles and rules of* to start this way.
- The alternative without a reference: copy or branch the model document into the project (each copy then evolves on
  its own).

## Choosing between pooled, paired and one role per document

| You want to check | Write |
|---|---|
| Every requirement is covered by some document of the downstream role | pooled (default): use cases 1, 2 |
| Each document is covered by **its own** downstream document | pairs: use cases 3, 4 |
| The same as pairs, with the pairs drawn as separate boxes | one role per document: use case 5 |
| Both: pooled coverage upstream, pairing downstream | pooled rule + paired rule in one model: use case 3 |

Not covered yet by any of them: chain coverage over several rules (e.g. "each customer requirement is satisfied by a
requirement that is itself verified"); each rule is checked on its own.
