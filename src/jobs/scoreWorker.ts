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
      if (user?.caregiverEmail) {
        await sendCaregiverAlert(user.caregiverEmail, user.name, result.explanation)
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

  // Only run if all 3 have ML scores (using != null to prevent 0 from falsely returning)
  if (
    gameSession?.riskScore == null || 
    chatSession?.languageScore == null || 
    webcamSession?.stressScore == null
  ) return

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
  if (result.riskLevel === 'High' && user.caregiverEmail) {
    await sendCaregiverAlert(user.caregiverEmail, user.name, result.explanation)
  }

  // Final step: Scan statistically for long-term deteriorating risk slopes
  await checkTrendAnomaly(userId)
}

async function checkTrendAnomaly(userId: string) {
  // 1. Fetch the last 7 RiskSnapshots sorted by date descending (0 is today)
  const snapshots = await RiskSnapshot.find({ userId }).sort({ date: -1 }).limit(7)
  
  // 2. Not enough data to run anomaly checks
  if (snapshots.length < 5) return

  // 3. Prevent spamming (Did we already alert them today?)
  const todaySnapshot = snapshots[0]
  if (todaySnapshot.anomalyAlertSent) return

  // 4. Check if trendSlope > 0.02 (worsening) for 5 recent consecutive snapshots
  const recent5 = snapshots.slice(0, 5)
  const isTrendWorsening = recent5.every(s => s.trendSlope > 0.02)
  if (!isTrendWorsening) return

  // 5. Check if compositeRiskScore increased in 4 of the last 5 days
  let increaseCount = 0
  const compareLimit = Math.min(snapshots.length - 1, 5) // Stop array bound crash
  for (let i = 0; i < compareLimit; i++) {
    // If newer snapshot score is strictly greater than older snapshot score
    if (snapshots[i].compositeRiskScore > snapshots[i+1].compositeRiskScore) {
      increaseCount++
    }
  }

  // 6. Alert if both critical conditions trigger
  if (increaseCount >= 4) {
    const user = await User.findById(userId)
    if (user?.caregiverEmail) {
      const message = "5-day worsening trend detected. Composite risk has increased consistently. Consider scheduling a check-in."
      await sendCaregiverAlert(user.caregiverEmail, user.name, message)
      
      // Update today's snapshot to block spam logic tomorrow
      await RiskSnapshot.findByIdAndUpdate(todaySnapshot._id, { anomalyAlertSent: true })
    }
  }
}

console.log('✅ Score worker running')
