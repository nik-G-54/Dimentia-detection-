import mongoose, { Document, Schema } from 'mongoose'

export interface IWebcamSession extends Document {
  userId: mongoose.Types.ObjectId
  dominantEmotion: string
  emotionConfidence: number
  avgBlinkRate: number      // under 8 or over 30 = stress/fatigue
  gazeStabilityScore: number // lower variance = more stable = better
  sessionDuration: number
  stressScore: number | null
  riskLevel: 'Low' | 'Medium' | 'High' | null
  explanation: string | null
  recordedAt: Date
}

const WebcamSessionSchema = new Schema<IWebcamSession>({
  userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
  dominantEmotion:    { type: String, required: true },
  emotionConfidence:  { type: Number, required: true },
  avgBlinkRate:       { type: Number, required: true },
  gazeStabilityScore: { type: Number, required: true },
  sessionDuration:    { type: Number, required: true },
  stressScore:        { type: Number, default: null },
  riskLevel:          { type: String, enum: ['Low','Medium','High'], default: null },
  explanation:        { type: String, default: null },
  recordedAt:         { type: Date, default: Date.now },
})

export default mongoose.model<IWebcamSession>('WebcamSession', WebcamSessionSchema)
