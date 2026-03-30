import scoreQueue from './scoreQueue'
import TestSession from '../models/TestSession'
import ChatSession from '../models/ChatSession'
import WebcamSession from '../models/WebcamSession'
import RiskSnapshot from '../models/RiskSnapshot'
import TaskLog from '../models/TaskLog'
import User from '../models/User'
import { scoreGame, scoreChat, scoreWebcam, scoreDaily } from '../services/mlClient'
import { sendCaregiverAlert } from '../services/alertService'

// Process game scoring jobs
scoreQueue.process('game', async (job) => {
  const { sessionId, userId, testType, score, timeTaken, errors, hesitationGaps, age } = job.data

  try {
    // Call Python ML service
    const result = await scoreGame({ userId, testType, score, timeTaken, errors, hesitationGaps, age })

    // Write result back to MongoDB
    await TestSession.findByIdAndUpdate(sessionId, {
      riskScore: result.riskScore,
      riskLevel: result.riskLevel,
      stage: result.stage,
      explanation: result.explanation,
    })

    // If high risk, alert caregiver
    if (result.riskLevel === 'High') {
      const user = await User.findById(userId)
      if (user?.caregiverPhone) {
        await sendCaregiverAlert(user.caregiverPhone, user.name, result.explanation)
      }
    }

    // Check if all 3 session types are done today → trigger daily composite
    await checkAndTriggerDailyComposite(userId)

  } catch (err) {
    console.error('Game scoring job failed:', err)
    throw err // Bull will retry automatically
  }
})

// Process chat scoring jobs
scoreQueue.process('chat', async (job) => {
  const { sessionId, ...payload } = job.data

  try {
    const result = await scoreChat(payload)

    await ChatSession.findByIdAndUpdate(sessionId, {
      languageScore: result.languageScore,
      riskLevel: result.riskLevel,
      explanation: result.explanation,
    })

    await checkAndTriggerDailyComposite(payload.userId)
  } catch (err) {
    console.error('Chat scoring job failed:', err)
    throw err
  }
})

// Process webcam scoring jobs
scoreQueue.process('webcam', async (job) => {
  const { sessionId, ...payload } = job.data

  try {
    const result = await scoreWebcam(payload)

    await WebcamSession.findByIdAndUpdate(sessionId, {
      stressScore: result.stressScore,
      riskLevel: result.riskLevel,
      explanation: result.explanation,
    })

    await checkAndTriggerDailyComposite(payload.userId)
  } catch (err) {
    console.error('Webcam scoring job failed:', err)
    throw err
  }
})

// Helper: fires POST /score/daily after all 3 session types exist today
async function checkAndTriggerDailyComposite(userId: string) {
  const today = new Date().toISOString().split('T')[0]

  // Get today's sessions
  const [gameSession, chatSession, webcamSession] = await Promise.all([
    TestSession.findOne({ userId, completedAt: { $gte: new Date(today) } }).sort({ completedAt: -1 }),
    ChatSession.findOne({ userId, recordedAt: { $gte: new Date(today) } }).sort({ recordedAt: -1 }),
    WebcamSession.findOne({ userId, recordedAt: { $gte: new Date(today) } }).sort({ recordedAt: -1 }),
  ])

  // Only run if all 3 have ML scores
  if (!gameSession?.riskScore || !chatSession?.languageScore || !webcamSession?.stressScore) return

  // Don't run twice for the same day
  const existingSnapshot = await RiskSnapshot.findOne({ userId, date: today })
  if (existingSnapshot) return

  // Get last 7 daily composite scores for trend
  const last7 = await RiskSnapshot.find({ userId }).sort({ date: -1 }).limit(7)
  const last7Scores = last7.map(s => s.compositeRiskScore).reverse()

  // Get today's task completion rate
  const taskLog = await TaskLog.findOne({ userId, date: today })
  const taskCompletionRate = taskLog ? taskLog.tasksCompleted / taskLog.tasksTotal : 0

  const user = await User.findById(userId)
  if (!user) return

  const result = await scoreDaily({
    userId,
    gameScore: gameSession.riskScore,
    chatScore: chatSession.languageScore,
    webcamScore: webcamSession.stressScore,
    taskCompletionRate,
    last7Scores,
    age: user.age,
    livesAlone: user.livesAlone,
  })

  // Save daily risk snapshot
  await RiskSnapshot.create({
    userId, date: today,
    compositeRiskScore: result.compositeRiskScore,
    riskLevel: result.riskLevel,
    stage: result.stage,
    trendSlope: result.trendSlope,
    explanation: result.explanation,
    sources: result.sources,
  })

  // Alert caregiver if high risk on composite
  if (result.riskLevel === 'High' && user.caregiverPhone) {
    await sendCaregiverAlert(user.caregiverPhone, user.name, result.explanation)
  }
}

console.log('✅ Score worker running')
