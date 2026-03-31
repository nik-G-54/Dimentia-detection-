import mongoose, { Document, Schema } from 'mongoose'

// One document per user per day — powers all trend graphs
export interface IRiskSnapshot extends Document {
  userId: mongoose.Types.ObjectId
  date: string
  compositeRiskScore: number
  riskLevel: 'Low' | 'Medium' | 'High'
  stage: 0 | 1 | 2 | 3
  trendSlope: number       // positive = worsening
  explanation: string
  anomalyAlertSent: boolean
  sources: {
    gameScore: number
    chatScore: number
    webcamScore: number
    taskRate: number
  }
}

const RiskSnapshotSchema = new Schema<IRiskSnapshot>({
  userId:             { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:               { type: String, required: true },
  compositeRiskScore: { type: Number, required: true },
  riskLevel:          { type: String, enum: ['Low','Medium','High'], required: true },
  stage:              { type: Number, enum: [0,1,2,3], required: true },
  trendSlope:         { type: Number, default: 0 },
  explanation:        { type: String, default: '' },
  anomalyAlertSent:   { type: Boolean, default: false },
  sources:            {
    gameScore:  { type: Number, default: 0 },
    chatScore:  { type: Number, default: 0 },
    webcamScore:{ type: Number, default: 0 },
    taskRate:   { type: Number, default: 0 },
  }
})

RiskSnapshotSchema.index({ userId: 1, date: -1 }, { unique: true })

export default mongoose.model<IRiskSnapshot>('RiskSnapshot', RiskSnapshotSchema)
