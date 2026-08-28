/**
 * Mock data layer for the Trustlify frontend.
 * All data is fictional and clearly marked as DEMO.
 * The real backend will replace this in a later phase.
 */

import type {
  Investigation,
  Claim,
  Source,
  Evidence,
  StudentProfile,
  StudentMatchResult,
  MonitoringItem,
  ChangeEvent,
  ActionItem,
} from '@/types'

/* ─── DEMO INVESTIGATION ─────────────────────────────────────────────────── */

export const demoClaims: Claim[] = [
  {
    id: 'claim_001',
    text: 'Fully Funded Scholarship 2025 is open for applications',
    type: 'opportunity',
    importance: 'critical',
    status: 'conflicting',
    reasoningSummary: 'The scholarship exists on the official university site but the circulating post links to an unofficial domain.',
  },
  {
    id: 'claim_002',
    text: 'Deadline: August 15, 2025',
    type: 'deadline',
    importance: 'critical',
    status: 'contradicted',
    reasoningSummary: 'Official source states August 25, 2025. The 10-day discrepancy is significant.',
  },
  {
    id: 'claim_003',
    text: 'Apply at apply-scholarship.com/fund2025',
    type: 'application_url',
    importance: 'critical',
    status: 'contradicted',
    reasoningSummary: 'Domain registered 15 days ago, no affiliation with the official institution.',
  },
]

export const demoSources: Source[] = [
  {
    id: 'src_001',
    investigationId: 'demo',
    url: 'https://university.edu.pk/scholarships/2025',
    title: 'Official Scholarship Page',
    domain: 'university.edu.pk',
    sourceType: 'official',
    publisher: 'University Registrar Office',
    publishedAt: '2025-03-01',
    updatedAt: '2025-07-15',
    retrievedAt: '2025-08-22',
    authorityLevel: 1,
    accessStatus: 'ok',
  },
  {
    id: 'src_002',
    investigationId: 'demo',
    url: 'https://hec.gov.pk/scholarships-2025',
    title: 'HEC Scholarship Announcement',
    domain: 'hec.gov.pk',
    sourceType: 'government',
    publisher: 'Higher Education Commission',
    publishedAt: '2025-02-28',
    retrievedAt: '2025-08-22',
    authorityLevel: 1,
    accessStatus: 'ok',
  },
  {
    id: 'src_003',
    investigationId: 'demo',
    url: 'https://apply-scholarship.com/fund2025',
    title: 'Suspicious Application Portal',
    domain: 'apply-scholarship.com',
    sourceType: 'submitted',
    retrievedAt: '2025-08-22',
    authorityLevel: 4,
    accessStatus: 'ok',
  },
  {
    id: 'src_004',
    investigationId: 'demo',
    url: 'https://community-reports.pk/scholarship-flags',
    title: 'Community Reports — Scholarship Flags',
    domain: 'community-reports.pk',
    sourceType: 'community',
    publisher: 'Student Community Forum',
    publishedAt: '2025-08-12',
    retrievedAt: '2025-08-22',
    authorityLevel: 3,
    accessStatus: 'ok',
  },
]

export const demoEvidence: Evidence[] = [
  {
    id: 'ev_001',
    claimId: 'claim_001',
    sourceId: 'src_001',
    excerpt: 'The scholarship programme is open for the 2025 cycle. Applications must be submitted through the official student portal only.',
    relation: 'supports',
    exactLocation: 'Paragraph 2, Section "Eligibility"',
    retrievedAt: '2025-08-22',
    verificationStatus: 'verified',
  },
  {
    id: 'ev_002',
    claimId: 'claim_002',
    sourceId: 'src_001',
    excerpt: 'Application deadline: August 25, 2025. Late applications will not be considered.',
    relation: 'contradicts',
    exactLocation: 'Section "Important Dates"',
    retrievedAt: '2025-08-22',
    verificationStatus: 'verified',
  },
  {
    id: 'ev_003',
    claimId: 'claim_003',
    sourceId: 'src_003',
    excerpt: 'Domain apply-scholarship.com was registered on August 7, 2025. No WHOIS association with university.edu.pk.',
    relation: 'contradicts',
    retrievedAt: '2025-08-22',
    verificationStatus: 'verified',
  },
  {
    id: 'ev_004',
    claimId: 'claim_001',
    sourceId: 'src_004',
    excerpt: 'Multiple users report receiving requests for CNIC and bank details after applying through the unofficial link.',
    relation: 'contradicts',
    retrievedAt: '2025-08-22',
    verificationStatus: 'pending',
  },
]

export const demoInvestigation: Investigation = {
  id: 'T-2408-0042',
  userId: 'demo_user',
  inputType: 'url',
  inputText: 'https://apply-scholarship.com/fund2025',
  status: 'COMPLETE',
  verdict: 'CAUTION',
  trustScore: 62,
  claims: demoClaims,
  sources: demoSources,
  evidence: demoEvidence,
  createdAt: '2025-08-22T10:00:00Z',
  updatedAt: '2025-08-22T10:00:18Z',
}

/* ─── STUDENT PROFILE ────────────────────────────────────────────────────── */

export const demoStudentProfile: StudentProfile = {
  education: 'BS Computer Science',
  age: 22,
  location: 'Karachi, Pakistan',
  skills: ['Python', 'Data Analysis', 'Research', 'Writing'],
  interests: ['Scholarships', 'Research Opportunities', 'Hackathons', 'Fellowships'],
  experience: '2 university projects, 1 hackathon win',
  portfolioUrl: 'https://ahmadkhan.dev',
}

export const demoStudentMatch: StudentMatchResult = {
  education: 'MATCH',
  age: 'MATCH',
  location: 'MATCH',
  skills: 'MATCH',
  experience: 'UNKNOWN',
  overall: 'STRONG',
}

/* ─── ACTION PLAN ────────────────────────────────────────────────────────── */

export const demoActionPlan: ActionItem[] = [
  { order: 1, text: 'Open the official university website directly (do not use the circulating link).', type: 'primary' },
  { order: 2, text: 'Do not submit CNIC, bank details, or OTP to the linked domain.', type: 'warning' },
  { order: 3, text: 'Confirm the current deadline on the official source (Aug 25, not Aug 15).', type: 'secondary' },
  { order: 4, text: 'Save this investigation and set a monitoring alert for deadline changes.', type: 'secondary' },
  { order: 5, text: 'If you received this link via WhatsApp, report it in your group.', type: 'secondary' },
]

/* ─── MONITORING ─────────────────────────────────────────────────────────── */

export const demoMonitoringItems: MonitoringItem[] = [
  { id: 'mon_001', investigationId: 'T-2408-0042', active: true, lastCheckedAt: '2025-08-22T08:00:00Z', createdAt: '2025-08-22T10:00:18Z' },
  { id: 'mon_002', investigationId: 'T-2408-0038', active: true, lastCheckedAt: '2025-08-21T12:00:00Z', createdAt: '2025-08-20T14:00:00Z' },
  { id: 'mon_003', investigationId: 'T-2408-0035', active: true, lastCheckedAt: '2025-08-19T06:00:00Z', createdAt: '2025-08-15T09:00:00Z' },
]

export const demoChangeEvents: ChangeEvent[] = [
  {
    id: 'chg_001',
    monitoringItemId: 'mon_002',
    field: 'deadline',
    beforeValue: 'August 15, 2025',
    afterValue: 'August 30, 2025',
    sourceId: 'src_002',
    importance: 'high',
    detectedAt: '2025-08-20T12:00:00Z',
  },
]

/* ─── HISTORY ────────────────────────────────────────────────────────────── */

export const demoHistory = [
  { date: 'Aug 22, 2025', title: 'Suspicious scholarship on Instagram', org: 'Unknown', verdict: 'VERIFY BEFORE APPLYING', status: 'conflict' as const, match: 'STRONG MATCH' },
  { date: 'Aug 20, 2025', title: 'LUMS MBA Fellowship link', org: 'LUMS', verdict: 'LIKELY LEGITIMATE', status: 'verified' as const, match: 'PARTIAL MATCH' },
  { date: 'Aug 18, 2025', title: 'WhatsApp internship forward', org: 'Unknown', verdict: 'HIGH RISK — DO NOT PROCEED', status: 'risk' as const, match: 'N/A' },
  { date: 'Aug 15, 2025', title: 'HEC Scholarship portal', org: 'HEC', verdict: 'LEGITIMATE', status: 'verified' as const, match: 'STRONG MATCH' },
  { date: 'Aug 12, 2025', title: 'Google Summer of Code 2025', org: 'Google', verdict: 'VERIFY BEFORE APPLYING', status: 'conflict' as const, match: 'LIKELY MATCH' },
  { date: 'Aug 8, 2025', title: 'UET merit list announcement', org: 'UET Lahore', verdict: 'LEGITIMATE', status: 'verified' as const, match: 'N/A' },
  { date: 'Aug 3, 2025', title: 'Facebook job ad screenshot', org: 'Unknown company', verdict: 'HIGH RISK', status: 'risk' as const, match: 'PARTIAL MATCH' },
  { date: 'Jul 28, 2025', title: 'Fulbright application guide PDF', org: 'Fulbright Pakistan', verdict: 'LEGITIMATE', status: 'verified' as const, match: 'STRONG MATCH' },
]

/* ─── SAVED OPPORTUNITIES ────────────────────────────────────────────────── */

export const demoSavedOpportunities = [
  { id: '1', title: 'HEC Research Fellowship 2025', org: 'Higher Education Commission', verdict: 'verified' as const, deadline: 'Sep 30, 2025', match: 'STRONG MATCH', matchColor: 'text-lime', lastChecked: '2h ago' },
  { id: '2', title: 'Google Summer of Code 2025', org: 'Google Open Source', verdict: 'conflict' as const, deadline: 'Apr 2, 2025', match: 'LIKELY MATCH', matchColor: 'text-caution', lastChecked: 'Yesterday' },
  { id: '3', title: 'LUMS MBA Fellowship', org: 'LUMS', verdict: 'verified' as const, deadline: 'Oct 15, 2025', match: 'PARTIAL MATCH', matchColor: 'text-soft', lastChecked: '3d ago' },
]

/* ─── INVESTIGATION PROGRESS STAGES ──────────────────────────────────────── */
/* Legacy alias — prefer INVESTIGATION_STAGES from useInvestigation hook */
export const investigationStages = [
  { id: 'NORMALIZING',   label: 'Reading input',        desc: 'Parsing URL structure, headers, and content signals' },
  { id: 'CLAIMS',        label: 'Extracting claims',    desc: '3 key claims identified and classified' },
  { id: 'SEARCH',        label: 'Finding sources',      desc: '7 relevant sources located across official and public data' },
  { id: 'EVIDENCE',      label: 'Comparing evidence',   desc: 'Cross-referencing sources for consistency' },
  { id: 'INVESTIGATING', label: 'Investigating deeply', desc: 'Domain analysis, red flag detection, currentness check' },
  { id: 'VERIFYING',     label: 'Verifying conclusions', desc: 'Assembling evidence relationships' },
  { id: 'MATCHING',      label: 'Matching profile',     desc: 'Comparing against your student profile' },
  { id: 'DECIDING',      label: 'Deciding verdict',     desc: 'Computing final evidence score and guidance' },
  { id: 'COMPLETE',      label: 'Investigation complete', desc: 'All checks finished — verdict ready' },
]
