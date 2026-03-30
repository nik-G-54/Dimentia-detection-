import mongoose, { Document, Schema } from 'mongoose'

// IMPORTANT: We never store raw message text. Only extracted signals.
export interface IChatSession extends Document {
  userId: mongoose.Types.ObjectId
  avgWPM: number
  wpmDelta: number          // negative = slowing down = bad signal
  backspaceRate: number     // 0.12 = 12% of keystrokes were backspace
  avgPauseBetweenMessages: number
  repetitionCount: number
  avgSentenceLength: number
  sessionDuration: number
  messageCount: number
  timeOfDay: number         // hour 0-23
  messages: string[]        // sent to ML for TextBlob, then discarded
  languageScore: number | null
  riskLevel: 'Low' | 'Medium' | 'High' | null
  explanation: string | null
  recordedAt: Date
}

const ChatSessionSchema = new Schema<IChatSession>({
  userId:                   { type: Schema.Types.ObjectId, ref: 'User', required: true },
  avgWPM:                   { type: Number, required: true },
  wpmDelta:                 { type: Number, default: 0 },
  backspaceRate:            { type: Number, default: 0 },
  avgPauseBetweenMessages:  { type: Number, default: 0 },
  repetitionCount:          { type: Number, default: 0 },
  avgSentenceLength:        { type: Number, default: 0 },
  sessionDuration:          { type: Number, required: true },
  messageCount:             { type: Number, default: 0 },
  timeOfDay:                { type: Number, required: true },
  messages:                 { type: [String], default: [] },
  languageScore:            { type: Number, default: null },
  riskLevel:                { type: String, enum: ['Low','Medium','High'], default: null },
  explanation:              { type: String, default: null },
  recordedAt:               { type: Date, default: Date.now },
})

ChatSessionSchema.index({ userId: 1, recordedAt: -1 })

export default mongoose.model<IChatSession>('ChatSession', ChatSessionSchema)
