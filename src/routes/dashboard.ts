import express from 'express'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import RiskSnapshot from '../models/RiskSnapshot'
import TestSession from '../models/TestSession'
import ChatSession from '../models/ChatSession'

const router = express.Router()

// GET /api/dashboard — everything the dashboard page needs in one call
router.get('/', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!

    // Latest risk snapshot
    const latest = await RiskSnapshot.findOne({ userId }).sort({ date: -1 })

    // 30-day trend data for the line chart
    const thirtyDaySnapshots = await RiskSnapshot.find({ userId })
      .sort({ date: -1 })
      .limit(30)
      .select('date compositeRiskScore riskLevel stage')

    // Last 7 game sessions for the memory performance bar chart
    const recentGames = await TestSession.find({ userId })
      .sort({ completedAt: -1 })
      .limit(7)
      .select('testType score riskScore completedAt')
  console.log(recentGames)
    // Typing speed trend (last 7 chat sessions)
    const recentChats = await ChatSession.find({ userId })
      .sort({ recordedAt: -1 })
      .limit(7)
      .select('avgWPM wpmDelta recordedAt')
console.log("chats responce show here "+recentChats)
    res.json({
      latestRisk: latest || null,
      trendData: thirtyDaySnapshots.reverse(), // oldest first for chart
      gameHistory: recentGames,
      typingTrend: recentChats.reverse(),
      
    })
   
  } catch (err) {
    res.status(500).json({ message: 'Failed to load dashboard', error: err })
  }
})

// GET /api/dashboard/reports/today
router.get('/reports/today', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]
    const userId = req.userId!

    const [snapshot, games, chats] = await Promise.all([
      RiskSnapshot.findOne({ userId, date: today }),
      TestSession.find({ userId, completedAt: { $gte: new Date(today) } }),
      ChatSession.find({ userId, recordedAt: { $gte: new Date(today) } }),
    ])

    res.json({ date: today, snapshot, games, chats })
  } catch (err) {
    res.status(500).json({ message: 'Failed to get today\'s report', error: err })
  }
})

// GET /api/dashboard/reports/history
router.get('/reports/history', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1
    const limit = 30
    const snapshots = await RiskSnapshot.find({ userId: req.userId! })
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)

    res.json(snapshots)
  } catch (err) {
    res.status(500).json({ message: 'Failed to get history', error: err })
  }
})

export default router
