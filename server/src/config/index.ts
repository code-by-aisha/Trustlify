/**
 * Trustlify Server — Configuration
 *
 * TODO: Load environment variables and validate required config.
 * TODO: Set up database connection string with fallback for local dev.
 * TODO: Configure AI provider API keys (OpenAI, Anthropic, or self-hosted).
 * TODO: Set up Redis connection for caching investigation results.
 * TODO: Configure rate limiting thresholds per tier.
 * TODO: Set up JWT signing keys and token expiry durations.
 */

export const config = {
  // Server
  port: process.env.PORT || 4000,
  nodeEnv: process.env.NODE_ENV || 'development',

  // Database
  // TODO: Replace with actual connection string in .env
  databaseUrl: process.env.DATABASE_URL || 'postgresql://localhost:5432/trustlify',

  // AI Provider
  // TODO: Support multiple providers (OpenAI, Anthropic, self-hosted)
  aiProvider: process.env.AI_PROVIDER || 'openai',
  aiApiKey: process.env.AI_API_KEY || '',
  aiModel: process.env.AI_MODEL || 'gpt-4o',

  // Auth
  // TODO: Generate proper JWT secrets for production
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-replace-in-production',
  jwtExpiry: '7d',

  // Redis
  // TODO: Set up Redis for caching and rate limiting
  redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

  // Rate Limiting
  // TODO: Implement tiered rate limiting (free/student/pro)
  rateLimit: {
    windowMs: 15 * 60 * 1000,
    maxRequests: 100,
  },

  // Monitoring
  // TODO: Configure monitoring check intervals
  monitoringIntervalMinutes: 60,

  // Storage
  // TODO: Set up file storage for uploaded images/PDFs (S3 or local)
  storagePath: process.env.STORAGE_PATH || './uploads',
  maxUploadSizeMb: 10,
} as const

export type Config = typeof config
