import Bull from 'bull'

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

// One queue, three job types (game, chat, webcam, daily)
const scoreQueue = new Bull('ml-scoring', redisUrl, {
  redis: redisUrl.startsWith('rediss://') ? {
    tls: { rejectUnauthorized: false }
  } : {}
})

export default scoreQueue
