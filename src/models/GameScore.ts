import mongoose, { Schema } from 'mongoose'

export interface IGameScore {
  userId: mongoose.Types.ObjectId
  gameId: 'sequence' | 'reaction' | 'number' | 'colorWord' | 'wordScramble'
  score: number
  errors: number
  level: number
  accuracy?: number
  reactionTime?: number
  duration?: number
  date: string
  createdAt: Date
}

const GameScoreSchema = new Schema<IGameScore>({
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  gameId: { 
    type: String, 
    enum: ['sequence', 'reaction', 'number', 'colorWord', 'wordScramble'], 
    required: true 
  },
  score: { type: Number, required: true, min: 0 },
  errors: { type: Number, required: true, default: 0 },
  level: { type: Number, required: true, default: 1 },
  accuracy: { type: Number, min: 0, max: 100 },
  reactionTime: { type: Number },
  duration: { type: Number },
  date: { type: String, required: true, index: true }, // YYYY-MM-DD
}, { timestamps: true })

GameScoreSchema.index({ userId: 1, date: -1 })
GameScoreSchema.index({ userId: 1, gameId: 1, date: -1 })

export default mongoose.model<IGameScore>('GameScore', GameScoreSchema)
