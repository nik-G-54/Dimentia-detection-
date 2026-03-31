import express from 'express'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import { z } from 'zod'

const TaskCompleteSchema = z.object({
  tasksCompleted: z.number().min(0),
  tasksTotal: z.number().min(1)
})
import TaskLog from '../models/TaskLog'
import User from '../models/User'
import RiskSnapshot from '../models/RiskSnapshot'

const router = express.Router()

// Helper: generate personalised tasks
function generateTasks(user: any, latestStage: number) {
  const tasks = [
    { id: 'play_game',    label: 'Complete today\'s brain activity', type: 'cognitive', urgent: false },
    { id: 'chat_session', label: 'Check in with your companion',    type: 'social',    urgent: false },
  ]

  if (user.age < 65) tasks.push({ id: 'walk',    label: '10-minute walk outside',     type: 'physical', urgent: false })
  else               tasks.push({ id: 'stretch', label: '5-minute gentle stretching', type: 'physical', urgent: false })

  if (user.education === 'graduate')
    tasks.push({ id: 'read', label: 'Read a news article and summarise it', type: 'mental', urgent: false })
  else
    tasks.push({ id: 'recall', label: 'Name 5 things you can see right now', type: 'mental', urgent: false })

  if (latestStage >= 2)
    tasks.push({ id: 'call_family', label: 'Call a family member today', type: 'social', urgent: true })

  return tasks
}

// GET /api/tasks/today
router.get('/today', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!
    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    const latestSnapshot = await RiskSnapshot.findOne({ userId }).sort({ date: -1 })
    const tasks = generateTasks(user, latestSnapshot?.stage || 0)

    // Check today's log for completion status
    const today = new Date().toISOString().split('T')[0]
    const log = await TaskLog.findOne({ userId, date: today })

    res.json({ tasks, tasksCompleted: log?.tasksCompleted || 0, streakDay: log?.streakDay || 0 })
  } catch (err) {
    res.status(500).json({ message: 'Failed to get tasks', error: err })
  }
})

// PUT /api/tasks/complete
router.put('/complete', verifyJWT, async (req: AuthRequest, res) => {
  const parsed = TaskCompleteSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors })
  }
  req.body = parsed.data

  try {
    const { tasksCompleted, tasksTotal } = req.body
    const today = new Date().toISOString().split('T')[0]
    const userId = req.userId!

    // Get yesterday's log to calculate streak
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]
    const yesterdayLog = await TaskLog.findOne({ userId, date: yesterdayStr })
    const streak = yesterdayLog ? yesterdayLog.streakDay + 1 : 1

    const log = await TaskLog.findOneAndUpdate(
      { userId, date: today },
      { userId, date: today, tasksCompleted, tasksTotal, streakDay: streak },
      { upsert: true, new: true }
    )

    res.json(log)
  } catch (err) {
    res.status(500).json({ message: 'Failed to update tasks', error: err })
  }
})

// GET /api/tasks/grid — last 365 days for GitHub-style grid
router.get('/grid', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const logs = await TaskLog.find({ userId: req.userId! })
      .sort({ date: -1 })
      .limit(365)

    // Shape: { "2026-03-30": 0.8, "2026-03-29": 1.0, ... }
    const grid: Record<string, number> = {}
    logs.forEach(log => {
      grid[log.date] = log.tasksTotal > 0 ? log.tasksCompleted / log.tasksTotal : 0
    })

    res.json(grid)
  } catch (err) {
    res.status(500).json({ message: 'Failed to get grid', error: err })
  }
})

export default router
