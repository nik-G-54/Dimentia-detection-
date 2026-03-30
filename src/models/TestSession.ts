import mongoose, { Schema } from 'mongoose'

// We omit 'extends Document' here to avoid conflict with Mongoose's built-in 'errors' validation property
export interface ITestSession {
  userId: mongoose.Types.ObjectId
  testType: 'memory_mosaic' | 'word_garden' | 'path_finder'
  score: number           // 0.0 to 1.0 — normalised by frontend
  timeTaken: number       // ms
  errors: number
  hesitationGaps: number[] // ms between each tap — the gold signal
  riskScore: number | null
  riskLevel: 'Low' | 'Medium' | 'High' | null
  stage: 0 | 1 | 2 | 3 | null
  explanation: string | null
  completedAt: Date
}

const TestSessionSchema = new Schema<ITestSession>({
  userId:          { type: Schema.Types.ObjectId, ref: 'User', required: true },
  testType:        { type: String, enum: ['memory_mosaic','word_garden','path_finder'], required: true },
  score:           { type: Number, required: true },
  timeTaken:       { type: Number, required: true },
  errors:          { type: Number, default: 0 },
  hesitationGaps:  { type: [Number], default: [] },
  riskScore:       { type: Number, default: null },
  riskLevel:       { type: String, enum: ['Low','Medium','High'], default: null },
  stage:           { type: Number, enum: [0,1,2,3], default: null },
  explanation:     { type: String, default: null },
  completedAt:     { type: Date, default: Date.now },
})

// Critical index for dashboard queries
TestSessionSchema.index({ userId: 1, completedAt: -1 })

export default mongoose.model<ITestSession>('TestSession', TestSessionSchema)
