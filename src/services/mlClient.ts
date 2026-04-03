import axios from 'axios'

const ML_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000'

const mlHeaders = () => ({
  'X-ML-API-Key': process.env.ML_API_KEY || '',
  'Content-Type': 'application/json',
})

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
  try {
    const { data } = await axios.post(`${ML_URL}/score/game`, payload, { headers: mlHeaders() })
    return data // { riskScore, riskLevel, stage, explanation }
  } catch (err: any) {
    console.error(`❌ ML API Error (/score/game):`, err.message)
    console.warn(`[ML Service Offline] Simulating Game Score...`)
    return { riskScore: 0.25, riskLevel: 'Low', stage: 0, explanation: '[MOCK] Normal hesitation patterns.' }
  }
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
  try {
    const { data } = await axios.post(`${ML_URL}/score/chat`, payload, { headers: mlHeaders() })
    return data // { languageScore, riskLevel, explanation }
  } catch (err: any) {
    console.error(`❌ ML API Error (/score/chat):`, err.message)
    console.warn(`[ML Service Offline] Simulating Chat Score...`)
    return { languageScore: 0.1, riskLevel: 'Low', explanation: '[MOCK] Natural typing rhythm.' }
  }
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
  try {
    const { data } = await axios.post(`${ML_URL}/score/webcam`, payload, { headers: mlHeaders() })
    return data // { stressScore, riskLevel, explanation }
  } catch (err: any) {
    console.error(`❌ ML API Error (/score/webcam):`, err.message)
    console.warn(`[ML Service Offline] Simulating Webcam Score...`)
    return { stressScore: 0.15, riskLevel: 'Low', explanation: '[MOCK] Patient appears relaxed.' }
  }
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
  try {
    const { data } = await axios.post(`${ML_URL}/score/daily`, payload, { headers: mlHeaders() })
    return data // { compositeRiskScore, riskLevel, stage, trendSlope, explanation, sources }
  } catch (err: any) {
    console.error(`❌ ML API Error (/score/daily):`, err.message)
    console.warn(`[ML Service Offline] Simulating Daily Composite Score...`)
    return { 
      compositeRiskScore: 0.2, 
      riskLevel: 'Low', 
      stage: 0, 
      trendSlope: 0.01, 
      explanation: '[MOCK] Overall status is healthy.', 
      sources: ['game', 'chat', 'webcam'] 
    }
  }
}
