# Review implementation status

Target: `laghzal49/elite-1337`, branch `review/implementation`. Upstream, the fork's main branch and live deployment are not modified by this work.

| Review item | Implemented result | Remaining deployment/data work |
|---|---|---|
| R01 | Policy failures fail closed rather than reverting to permissive defaults | Database outages may temporarily prevent access; this is deliberate |
| R02 | Add-user is an idempotent neutral insert | None |
| R03 | Atomic PostgreSQL permits share 600 ms / 1,100-per-hour limits | All instances must share DATABASE_URL; OAuth headroom is not unlimited |
| R04 | Complete per-campus snapshots survive refresh failures; expiring leases coordinate refresh | Cold starts can still wait; verify background function limits in staging |
| R05 | Bot-compatible Peer Video metadata exclusion; unknown projects excluded | No live 42 credential was used; verify current response metadata in staging |
| R06 | Return-rate labels, sample warnings and latest-100 coverage | Rates do not establish fairness or strictness |
| R07 | Privacy exclusions precede top-ten truncation | None |
| R08 | Requested campus/window slices only, with overlapping-slice reuse | Page counts depend on actual campus traffic |
| R09 | Owner-only disable/regenerate sharing, individual nonce revocation | Third-party cached images may remain temporarily |
| R10 | Both apps checked independently; mobile browser tests and local Postgres integration tests | Remote CI/branch protection must be checked before merge |
| R11 | Validated JSON inventory loading rejects duplicate/mismatched seats | Actual authoritative inventory has not been supplied; registry remains empty |
| R12 | Current operational docs, idempotent migration bootstrap and transactional policy audit | License remains owner-controlled; older tables retain lazy setup for compatibility |
| Requested feature | Clear waiting-for-correction submission view, older pending records, refresh controls, honest timestamps | Visible selected-campus ranking population only; not all 42 accounts |

## Validation and rollout

Unit, SQL integration, type, production-build and browser results are recorded at completion of the change. Tests use synthetic accounts and local fixtures; no production database, 42 credentials or Discord sends are used.

Run `npx tsx --env-file=.env.local scripts/migrate.ts` against staging before deploying. The bootstrap is idempotent and records migration version 1 only after all steps succeed. Back up first; application startup retains lazy table creation for compatibility. Later migrations must be new versions, not edits that silently reinterpret existing data.

Deploy the branch to an isolated staging environment with a separate 42 application. Validate actual cold/warm request cost, background-refresh lifetime, sign-in, privacy changes and revocation. Do not merge or deploy merely because unit tests pass. Database owners can alter audit records; the application exposes no audit-delete operation.

Rollback application commits in reverse dependency order. Keep new tables during rollback so audit history and revocation state are not destroyed. Rolling back the revocation implementation can restore legacy card links; assess that privacy consequence before rollback. No automatic destructive down-migration is provided.

## API cost evidence

Mocked correction-loader checks: 30-day single-campus scope performs four slice fetches; extending it to 90 days brings the total to ten, not fourteen; requesting a second 30-day campus brings the total to fourteen. A slice can contain several API pages. A fully warm repeated scope adds zero loader calls within single-flight retention. Real cold/warm API request counts have not been measured because production credentials are deliberately not used.

## Deferred product proposals

Saved XP plans, personal weekly history and correction notifications remain optional follow-up work. They were suggestions in the review, not prerequisites for repairing existing functionality. No extra notification messages are sent by this implementation.
