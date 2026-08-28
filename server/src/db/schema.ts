/**
 * Trustlify Server — Database Schema
 *
 * TODO: Set up ORM (Prisma or Drizzle) with the following tables:
 *
 * users
 *   - id (UUID, PK)
 *   - email (unique)
 *   - password_hash
 *   - role (student | general)
 *   - created_at
 *   - updated_at
 *
 * student_profiles
 *   - id (UUID, PK)
 *   - user_id (FK → users)
 *   - full_name
 *   - age
 *   - location
 *   - education_level
 *   - institution
 *   - field_of_study
 *   - skills (JSON array)
 *   - interests (JSON array)
 *   - profile_completeness (int, 0-100)
 *
 * investigations
 *   - id (UUID, PK)
 *   - user_id (FK → users, nullable for anonymous)
 *   - input_type (link | text | image)
 *   - input_data (JSON — URL, raw text, or file reference)
 *   - status (pending | processing | complete | failed)
 *   - verdict (verified | caution | high_risk | unverified)
 *   - trust_score (int, 0-100)
 *   - risk_signals (JSON array)
 *   - action_plan (JSON array)
 *   - created_at
 *   - updated_at
 *
 * claims
 *   - id (UUID, PK)
 *   - investigation_id (FK → investigations)
 *   - text
 *   - classification (factual | interpretive | mixed)
 *
 * sources
 *   - id (UUID, PK)
 *   - investigation_id (FK → investigations)
 *   - claim_id (FK → claims, nullable)
 *   - title
 *   - url
 *   - domain
 *   - source_type (official | government | news | public | technical)
 *   - source_tier (tier_1 | tier_2 | tier_3 | tier_4)
 *   - published_date
 *   - retrieved_at
 *   - excerpt
 *   - relation (supports | contradicts | neutral)
 *
 * evidence_nodes
 *   - id (UUID, PK)
 *   - investigation_id (FK → investigations)
 *   - node_type (claim | source | evidence | conflict | verification | decision)
 *   - label
 *   - data (JSON)
 *   - position_x (float, for graph layout)
 *   - position_y (float, for graph layout)
 *
 * evidence_edges
 *   - id (UUID, PK)
 *   - investigation_id (FK → investigations)
 *   - source_node_id (FK → evidence_nodes)
 *   - target_node_id (FK → evidence_nodes)
 *   - relation_type (supports | contradicts | neutral)
 *   - weight (float, 0-1)
 *
 * student_matches
 *   - id (UUID, PK)
 *   - investigation_id (FK → investigations)
 *   - user_id (FK → users)
 *   - match_strength (likely | possible | unlikely | insufficient_data)
 *   - field_matches (JSON array of { field, status, note })
 *   - overall_score (int, 0-100)
 *
 * monitoring_items
 *   - id (UUID, PK)
 *   - user_id (FK → users)
 *   - investigation_id (FK → investigations)
 *   - title
 *   - organization
 *   - deadline
 *   - active (boolean)
 *   - last_checked_at
 *   - created_at
 *
 * change_events
 *   - id (UUID, PK)
 *   - monitoring_item_id (FK → monitoring_items)
 *   - change_type (deadline_change | content_change | status_change | new_source)
 *   - before_value
 *   - after_value
 *   - source_url
 *   - detected_at
 *
 * user_settings
 *   - id (UUID, PK)
 *   - user_id (FK → users)
 *   - language (enum)
 *   - notifications (JSON)
 *   - privacy (JSON)
 *
 * saved_evidence
 *   - id (UUID, PK)
 *   - user_id (FK → users)
 *   - investigation_id (FK → investigations)
 *   - title
 *   - type
 *   - saved_at
 */

export {}
