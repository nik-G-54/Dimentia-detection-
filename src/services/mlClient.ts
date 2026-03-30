import axios from 'axios'

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

// Calls POST /score/game on Python FastAPI
export const scoreGame = async (payload: {
  userId: string
  testType: string
  score: number
  timeTaken: number
  errors: number
  hesitationGaps: number[]
  age: number
}) => {
  const { data } = await axios.post(`${ML_URL}/score/game`, payload)
  return data // { riskScore, riskLevel, stage, explanation }
}

// Calls POST /score/chat on Python FastAPI
export const scoreChat = async (payload: {
  userId: string
  avgWPM: number
  wpmDelta: number
  backspaceRate: number
  avgPauseBetweenMessages: number
  repetitionCount: number
  avgSentenceLength: number
  messages: string[]
  sessionDuration: number
  messageCount: number
  timeOfDay: number
}) => {
  const { data } = await axios.post(`${ML_URL}/score/chat`, payload)
  return data // { languageScore, riskLevel, explanation }
}

// Calls POST /score/webcam on Python FastAPI
export const scoreWebcam = async (payload: {
  userId: string
  dominantEmotion: string
  emotionConfidence: number
  avgBlinkRate: number
  gazeStabilityScore: number
  sessionDuration: number
}) => {
  const { data } = await axios.post(`${ML_URL}/score/webcam`, payload)
  return data // { stressScore, riskLevel, explanation }
}

// Calls POST /score/daily on Python FastAPI
export const scoreDaily = async (payload: {
  userId: string
  gameScore: number
  chatScore: number
  webcamScore: number
  taskCompletionRate: number
  last7Scores: number[]
  age: number
  livesAlone: boolean
}) => {
  const { data } = await axios.post(`${ML_URL}/score/daily`, payload)
  return data // { compositeRiskScore, riskLevel, stage, trendSlope, explanation, sources }
}
