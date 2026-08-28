# TRUSTLIFY — BACKEND + AI HANDOFF V2

## STACK

Node
Express
TypeScript
Zod
Supabase/PostgreSQL
Supabase Storage
Model Studio/Qwen

---

# CORE MODULES

1. input-normalizer
2. claim-extractor
3. search-planner
4. source-retriever
5. evidence-extractor
6. investigator
7. verifier
8. source-identity
9. temporal-engine
10. risk-engine
11. trust-engine
12. student-matcher
13. decision-builder
14. monitoring

---

# DATABASE

profiles
investigations
claims
sources
evidence
decisions
monitoring_items
change_events
uploads

---

# SOURCE FIELDS

id
url
title
domain
sourceType
publisher
publishedAt
updatedAt
retrievedAt
authorityLevel
contentHash

---

# EVIDENCE FIELDS

id
claimId
sourceId
excerpt
relation
exactLocation
retrievedAt
verificationStatus

---

# IMPORTANT RULE

Every critical claim requires:
- at least one valid source
- evidence excerpt/relationship
- verifier state

If absent:
UNVERIFIED.

---

# SOURCE HIERARCHY

Tier 1:
official/government/official application

Tier 2:
recognized independent sources

Tier 3:
community/public reports

Tier 4:
weak/anonymous/unverified

---

# HUMAN EVIDENCE

Treat reports as leads first.

Corroborate before making a strong conclusion.

Never count the number of comments as a truth score.

---

# TEMPORAL ENGINE

Track:
published
updated
retrieved

Determine:
current
possibly outdated
unknown

---

# DOMAIN ENGINE

Check:
organization ↔ domain
submitted ↔ official
redirects
typosquatting signals
known trusted domain registry

---

# TRUST ENGINE

Suggested signals:
official source
independent confirmation
freshness
domain match
conflict
redirect
missing evidence
sensitive request
public warning
verifier state

---

# API

POST /api/investigations
POST /api/investigations/:id/start
GET /api/investigations/:id
GET /api/investigations/:id/evidence
POST /api/investigations/:id/recheck
POST /api/investigations/:id/monitor
GET /api/monitoring
POST /api/profile
POST /api/uploads

---

# FAILURE STATES

No source
→ UNVERIFIED

Sources conflict
→ CAUTION / CONFLICTING EVIDENCE

Verifier rejects
→ downgrade claim

Provider timeout
→ retry/fallback status, never fabricate

Image OCR weak
→ flag extraction uncertainty

---

# SECURITY

- server-side API keys
- safe URL handling
- prompt injection defense
- rate limits
- schema validation
- upload validation
- sensitive data minimization
