import express from 'express'
import { verifyJWT, AuthRequest } from '../middleware/auth'
import { z } from 'zod'

const GameSessionSchema = z.object({
  testType: z.enum(['memory_mosaic', 'word_garden', 'path_finder']),
  score: z.number().min(0).max(1),
  timeTaken: z.number().positive(),
  errors: z.number().default(0),
  hesitationGaps: z.array(z.number()).default([]),
})

const ChatSessionSchema = z.object({
  avgWPM: z.number(),
  wpmDelta: z.number(),
  backspaceRate: z.number(),
  avgPauseBetweenMessages: z.number(),
  repetitionCount: z.number(),
  avgSentenceLength: z.number(),
  messages: z.array(z.string()),
  sessionDuration: z.number(),
  messageCount: z.number(),
  timeOfDay: z.number()
})

const WebcamSessionSchema = z.object({
  dominantEmotion: z.string(),
  emotionConfidence: z.number().min(0).max(1),
  avgBlinkRate: z.number().positive(),
  gazeStabilityScore: z.number().min(0).max(1),
  sessionDuration: z.number().positive()
})
import TestSession from '../models/TestSession'
import ChatSession from '../models/ChatSession'
import WebcamSession from '../models/WebcamSession'
import User from '../models/User'
import scoreQueue from '../jobs/scoreQueue'

const router = express.Router()

// POST /api/sessions/game — frontend submits after game ends
router.post('/game', verifyJWT, async (req: AuthRequest, res) => {
  const parsed = GameSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors })
  }
  req.body = parsed.data

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
  const parsed = ChatSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors })
  }
  req.body = parsed.data

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
  const parsed = WebcamSessionSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ message: 'Validation failed', errors: parsed.error.errors })
  }
  req.body = parsed.data

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

// GET /api/sessions/chat/:id
router.get('/chat/:id', verifyJWT, async (req, res) => {
  try {
    const session = await ChatSession.findById(req.params.id)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    if (session.languageScore === null) {
      return res.json({ status: 'processing' })
    }

    res.json({
      status: 'complete',
      languageScore: session.languageScore,
      riskLevel: session.riskLevel,
      explanation: session.explanation,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch chat session', error: String(err) })
  }
})

// GET /api/sessions/chat
router.get('/chat', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const sessions = await ChatSession.find({ userId: req.userId })
      .sort({ recordedAt: -1 })
      .limit(20)
    res.json(sessions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch chat sessions', error: String(err) })
  }
})

// GET /api/sessions/webcam/:id
router.get('/webcam/:id', verifyJWT, async (req, res) => {
  try {
    const session = await WebcamSession.findById(req.params.id)
    if (!session) return res.status(404).json({ message: 'Session not found' })

    if (session.stressScore === null) {
      return res.json({ status: 'processing' })
    }

    res.json({
      status: 'complete',
      stressScore: session.stressScore,
      riskLevel: session.riskLevel,
      explanation: session.explanation,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch webcam session', error: String(err) })
  }
})

// GET /api/sessions/webcam
router.get('/webcam', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const sessions = await WebcamSession.find({ userId: req.userId })
      .sort({ recordedAt: -1 })
      .limit(20)
    res.json(sessions)
  } catch (err) {
    console.error(err)
    res.status(500).json({ message: 'Failed to fetch webcam sessions', error: String(err) })
  }
})

export default router
