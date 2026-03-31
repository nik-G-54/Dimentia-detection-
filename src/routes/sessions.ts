import express from 'express'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import TestSession from '../models/TestSession'
import ChatSession from '../models/ChatSession'
import WebcamSession from '../models/WebcamSession'
import User from '../models/User'
import scoreQueue from '../jobs/scoreQueue'

const router = express.Router()

// POST /api/sessions/game — frontend submits after game ends
router.post('/game', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const { testType, score, timeTaken, errors, hesitationGaps } = req.body
    const userId = req.userId!

    const user = await User.findById(userId)
    if (!user) return res.status(404).json({ message: 'User not found' })

    // Step 1: Save immediately with null scores (fast response to frontend)
    const session = await TestSession.create({
      userId, testType, score, timeTaken, errors,
      hesitationGaps: hesitationGaps || [],
      riskScore: null, riskLevel: null, stage: null, explanation: null,
    })

    // Step 2: Enqueue ML job (non-blocking)
    await scoreQueue.add('game', {
      sessionId: session._id.toString(),
      userId,
      testType, score, timeTaken, errors,
      hesitationGaps: hesitationGaps || [],
      age: user.age,
    })

    // Step 3: Return immediately — frontend will poll
    res.status(201).json({
      sessionId: session._id,
      status: 'processing',
      message: 'Analysing your results...'
    })
  } catch (err: any) {
    console.error('Crash in /game:', err)
    res.status(500).json({ message: 'Failed to submit game session', error: err.message || String(err) })
  }
})

// GET /api/sessions/game/:id — frontend polls this every 2 seconds
router.get('/game/:id', verifyJWT, async (req, res) => {
  try {
    const session = await TestSession.findById(req.params.id)
    if (!session) {
      console.log('Session is missing:', session)
      return res.status(404).json({ message: 'Session not found' })
    }

    if (session.riskScore === null) {
      // Still processing
      return res.json({ status: 'processing' })
    }

    // ML is done — return full result
    res.json({
      status: 'complete',
      riskScore: session.riskScore,
      riskLevel: session.riskLevel,
      stage: session.stage,
      explanation: session.explanation,
    })
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Failed to fetch session', error: err })
  }
})

// GET /api/sessions/game — all game sessions for a user
router.get('/game', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const sessions = await TestSession.find({ userId: req.userId })
      .sort({ completedAt: -1 })
      .limit(20)
    res.json(sessions)
    console.log(sessions)
  } catch (err) {
    console.log(err)
    res.status(500).json({ message: 'Failed to fetch sessions', error: err }
      
    )
  }
})

// POST /api/sessions/chat
router.post('/chat', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const payload = req.body
    const userId = req.userId!

    const session = await ChatSession.create({
      userId, ...payload,
      languageScore: null, riskLevel: null, explanation: null,
    })

    await scoreQueue.add('chat', {
      sessionId: session._id.toString(),
      userId, ...payload,
    })

    res.status(201).json({ sessionId: session._id, status: 'processing' })
  } catch (err: any) {
    console.error('Crash in /chat:', err)
    res.status(500).json({ message: 'Failed to submit chat session', error: err.message || String(err) })
  }
})

// POST /api/sessions/webcam
router.post('/webcam', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const payload = req.body
    const userId = req.userId!

    const session = await WebcamSession.create({
      userId, ...payload,
      stressScore: null, riskLevel: null, explanation: null,
    })

    await scoreQueue.add('webcam', {
      sessionId: session._id.toString(),
      userId, ...payload,
    })

    res.status(201).json({ sessionId: session._id, status: 'processing' })
  } catch (err: any) {
    console.error('Crash in /webcam:', err)
    res.status(500).json({ message: 'Failed to submit webcam session', error: err.message || String(err) })
  }
})

export default router
