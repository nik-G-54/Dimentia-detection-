import express from 'express'
import mongoose from 'mongoose'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import RiskSnapshot from '../models/RiskSnapshot'
import TestSession from '../models/TestSession'
import ChatSession from '../models/ChatSession'
import WebcamSession from '../models/WebcamSession'
import GameScore from '../models/GameScore'
import TaskLog from '../models/TaskLog'

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

    // ── Fetch today's data in parallel ──
    const [snapshot, todayGames, todayChats, taskLog] = await Promise.all([
      RiskSnapshot.findOne({ userId, date: today }),
      TestSession.find({ userId, completedAt: { $gte: new Date(today) } }),
      ChatSession.find({ userId, recordedAt: { $gte: new Date(today) } }),
      TaskLog.findOne({ userId, date: today }),
    ])

    // ── Helper: stage → badge text + variant ──
    const stageInfo = (stage: number | null) => {
      switch (stage) {
        case 0:  return { text: 'Stage 0', badge: 'Normal Baseline',  variant: 'low' }
        case 1:  return { text: 'Stage 1', badge: 'Mild Concern',     variant: 'info' }
        case 2:  return { text: 'Stage 2', badge: 'Moderate Risk',    variant: 'med' }
        case 3:  return { text: 'Stage 3', badge: 'High Risk — Alert',variant: 'high' }
        default: return { text: 'Stage 0', badge: 'Normal Baseline',  variant: 'low' }
      }
    }

    // ── 1. Stage info (from RiskSnapshot or latest game session) ──
    const latestStage = snapshot?.stage 
      ?? todayGames.sort((a, b) => (b.stage ?? 0) - (a.stage ?? 0))[0]?.stage 
      ?? null
    const { text: stageText, badge: stageBadge, variant: stageVariant } = stageInfo(latestStage)

    // ── 2. Average WPM from today's chat sessions ──
    const avgWpmRaw = todayChats.length > 0
      ? todayChats.reduce((sum, c) => sum + c.avgWPM, 0) / todayChats.length
      : null

    const avgWpm      = avgWpmRaw !== null ? `${Math.round(avgWpmRaw)} WPM` : 'No Data'
    const wpmVariant  = avgWpmRaw === null ? 'info' : avgWpmRaw < 30 ? 'high' : avgWpmRaw < 50 ? 'med' : 'low'
    const wpmBadge    = avgWpmRaw === null ? 'No Session Yet' 
                      : avgWpmRaw < 30     ? 'Slowed Cadence' 
                      : avgWpmRaw < 50     ? 'Moderate Cadence' 
                      : 'Stable Cadence'

    // ── 3. Engagement rate from TaskLog ──
    const engagementRaw = taskLog 
      ? Math.round((taskLog.tasksCompleted / taskLog.tasksTotal) * 100)
      : null
    const engagement        = engagementRaw !== null ? `${engagementRaw}%` : 'No Data'
    const engagementVariant = engagementRaw === null ? 'med'
                            : engagementRaw >= 80    ? 'low'
                            : engagementRaw >= 50    ? 'med'
                            : 'high'
    const engagementBadge   = engagementRaw === null ? 'No Activity Yet'
                            : engagementRaw >= 80    ? 'High Adherence'
                            : engagementRaw >= 50    ? 'Moderate Adherence'
                            : 'Low Adherence'

    return res.json({
      date: today,
      // Fields the frontend reads directly:
      stage:             stageText,
      stageVariant,
      stageBadge,
      avgWpm,
      wpmVariant,
      wpmBadge,
      engagement,
      engagementVariant,
      engagementBadge,
      // Raw data for future use:
      compositeRiskScore: snapshot?.compositeRiskScore ?? null,
      riskLevel:          snapshot?.riskLevel ?? null,
      explanation:        snapshot?.explanation ?? null,
      trendSlope:         snapshot?.trendSlope ?? null,
      sources:            snapshot?.sources ?? null,
      sessionCount: {
        games:   todayGames.length,
        chats:   todayChats.length,
        hasData: todayGames.length > 0 || todayChats.length > 0,
      }
    })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get today\'s report', error: err })
  }
})

// GET /api/dashboard/reports/history
router.get('/reports/history', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!

    // ── 1. Risk Trend: last 30 RiskSnapshots, oldest first ──
    const snapshots = await RiskSnapshot.find({ userId })
      .sort({ date: 1 })
      .limit(30)
      .select('date compositeRiskScore')

    const riskTrend = snapshots.map((s, i) => ({
      day: `Day ${i + 1}`,
      score: parseFloat(s.compositeRiskScore.toFixed(3)),
    }))

    // ── 2. Game Performance: aggregate best score per testType ──
    const gameSessions = await TestSession.find({ userId })
      .select('testType score riskScore')

    // Map testType → friendly display name
    const typeNameMap: Record<string, string> = {
      memory_mosaic: 'Memory',
      word_garden:   'Language',
      path_finder:   'Pattern',
      color_word:    'Attention',
      word_scramble: 'Speed',
    }

    // Compute average score per testType (score is 0.0–1.0 → multiply by 100)
    const typeMap: Record<string, { sum: number; count: number }> = {}
    for (const s of gameSessions) {
      if (!typeMap[s.testType]) typeMap[s.testType] = { sum: 0, count: 0 }
      typeMap[s.testType].sum   += s.score
      typeMap[s.testType].count += 1
    }

    const gamePerformance = Object.entries(typeMap).map(([type, { sum, count }]) => ({
      name:  typeNameMap[type] || type,
      score: Math.min(100, Math.max(0, Math.round((sum / count) * 100))),
    }))

    // Also pull from GameScore model (the simpler game engine scores)
    const gameScoreSummary = await GameScore.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: {
          _id: '$gameId',
          avgScore: { $avg: '$score' },
          bestScore: { $max: '$score' },
      }},
    ])

    const gameIdNameMap: Record<string, string> = {
      sequence:    'Sequence',
      reaction:    'Reaction',
      number:      'Number',
      colorWord:   'Color-Word',
      wordScramble:'Word Scramble',
    }

    // Merge — prefer TestSession data if available, else GameScore
    if (gamePerformance.length === 0) {
      gameScoreSummary.forEach(g => {
        let pct = g.avgScore;
        // Normalize common unbounded scores if needed
        if (g._id === 'reaction' || g._id === 'target') {
          pct = Math.max(0, Math.round((1000 - pct) / 8));
        } else if (pct > 0 && pct <= 30) {
          pct = (pct / 30) * 100;
        }

        gamePerformance.push({
          name:  gameIdNameMap[g._id] || g._id,
          score: Math.min(100, Math.max(0, Math.round(pct))),
        })
      })
    }

    // ── 3. Chat History: get the recent checked chat sessions ──
    const chatHistory = await ChatSession.find({ userId, explanation: { $exists: true, $ne: null } })
      .sort({ recordedAt: -1 })
      .limit(10)
      .select('recordedAt riskLevel languageScore explanation avgWPM');

    return res.json({ riskTrend, gamePerformance, chatHistory })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get history', error: err })
  }
})

// GET /api/dashboard/reports/summary — full cognitive profile for Reports page
router.get('/reports/summary', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const userId = req.userId!

    // ── 1. Latest risk snapshot ──
    const latest = await RiskSnapshot.findOne({ userId }).sort({ date: -1 })

    // ── 2. All-time game stats ──
    const allGames = await TestSession.find({ userId }).select('testType score riskScore stage completedAt')
    const allChats = await ChatSession.find({ userId }).select('avgWPM languageScore riskLevel recordedAt')

    // ── 3. Overall composite stats ──
    const totalSessions = allGames.length + allChats.length
    const avgRiskScore = allGames.length > 0
      ? allGames.filter(g => g.riskScore !== null).reduce((s, g) => s + (g.riskScore ?? 0), 0) / allGames.filter(g => g.riskScore !== null).length
      : 0

    // ── 4. Best scores per game type ──
    const bestByType: Record<string, number> = {}
    allGames.forEach(g => {
      if (!bestByType[g.testType] || g.score > bestByType[g.testType]) {
        bestByType[g.testType] = g.score
      }
    })

    // ── 5. Last 7 risk snapshots for trend ──
    const last7 = await RiskSnapshot.find({ userId }).sort({ date: -1 }).limit(7).select('date compositeRiskScore stage')

    // ── 6. Streak ──
    const lastTask = await TaskLog.findOne({ userId }).sort({ date: -1 })

    return res.json({
      latestRisk: latest
        ? {
            compositeRiskScore: latest.compositeRiskScore,
            riskLevel:          latest.riskLevel,
            stage:              latest.stage,
            trendSlope:         latest.trendSlope,
            explanation:        latest.explanation,
            date:               latest.date,
            sources:            latest.sources,
          }
        : null,
      stats: {
        totalSessions,
        avgRiskScore: parseFloat(avgRiskScore.toFixed(3)),
        bestScoresByType: bestByType,
      },
      last7Days: last7.reverse().map(s => ({
        date:  s.date,
        score: s.compositeRiskScore,
        stage: s.stage,
      })),
      streakDay: lastTask?.streakDay ?? 0,
    })
  } catch (err) {
    return res.status(500).json({ message: 'Failed to get summary', error: err })
  }
})

export default router
