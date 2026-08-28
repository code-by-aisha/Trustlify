# Trustlify — Backend Phase Map

## PHASE 1 — Backend Foundation (CURRENT)

**Status:** Complete

- Node/Express/TypeScript server
- Environment validation (Zod)
- Security headers (Helmet)
- CORS configuration
- Request body size limits
- Rate limiting
- Request ID tracing
- Centralized error handling (no stack traces in production)
- Auth middleware interface (Supabase JWT ready)
- Authorization helpers (requireOwnership)
- Zod validators for all future inputs
- AIProvider interface
- ModelStudioProvider placeholder
- Investigation pipeline interface + InMemoryJobStore
- Upload metadata validation
- API route skeletons
- URL safety utilities
- Structured logging with sensitive data redaction
- Graceful shutdown
- Tests for health, 404, validation, auth, request ID

## PHASE 2 — Supabase + Auth + RLS + Storage

- Initialize Supabase client
- Implement `authenticateUser()` with real JWT validation
- Create database tables (profiles, investigations, claims, sources, evidence, decisions, monitoring_items, change_events, uploads)
- Row Level Security (RLS) policies — user can only access own data
- Supabase Storage for file uploads (image, PDF)
- Profile CRUD with Supabase
- Investigation persistence
- History queries

## PHASE 3 — Model Studio

- Configure DASHSCOPE_API_KEY
- Implement `ModelStudioProvider` methods
- Connection test: verify API key, call model, validate structured JSON response
- Quota protection (free quota monitoring)
- Model strategy: primary model for reasoning, fast model for formatting

## PHASE 4 — Investigation Pipeline

- Claim extraction (AIProvider.extractClaims)
- Search planning (AIProvider.planSearch)
- Web search via Model Studio Responses API
- Web page content extraction
- Evidence analysis (AIProvider.analyzeEvidence)
- Verifier (AIProvider.verifyClaims)
- Async job execution with state transitions
- Pipeline error handling and retry logic

## PHASE 5 — Trust Engine + Student Match + Risk

- Deterministic trust score calculation
- Risk signal detection
- Currentness engine
- Student profile matching (AIProvider.matchStudent)
- Decision builder with action plan generation
- AIProvider.explainDecision for human-readable results

## PHASE 6 — Frontend Integration

- Wire frontend API calls to real backend
- VITE_API_BASE_URL configuration
- Evidence graph data format (React Flow compatible)
- Real-time investigation progress polling
- File upload flow
- Error state handling in UI

## PHASE 7 — Monitoring + Deployment

- Scheduled re-checks (monitoring cron)
- Change detection and notifications
- History search and filtering
- Deployment to Alibaba Function Compute or approved host
- Production environment configuration
- Observability and logging infrastructure
