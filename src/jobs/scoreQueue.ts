import Bull from 'bull'

// One queue, three job types (game, chat, webcam, daily)
const scoreQueue = new Bull('ml-scoring', {
  redis: process.env.REDIS_URL || 'redis://localhost:6379'
})

export default scoreQueue
