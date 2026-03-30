import mongoose, { Document, Schema } from 'mongoose'

export interface ITaskLog extends Document {
  userId: mongoose.Types.ObjectId
  date: string           // "YYYY-MM-DD" — used for GitHub grid
  tasksCompleted: number
  tasksTotal: number
  streakDay: number
  loggedAt: Date
}

const TaskLogSchema = new Schema<ITaskLog>({
  userId:         { type: Schema.Types.ObjectId, ref: 'User', required: true },
  date:           { type: String, required: true },
  tasksCompleted: { type: Number, default: 0 },
  tasksTotal:     { type: Number, required: true },
  streakDay:      { type: Number, default: 1 },
  loggedAt:       { type: Date, default: Date.now },
})

TaskLogSchema.index({ userId: 1, date: -1 })

export default mongoose.model<ITaskLog>('TaskLog', TaskLogSchema)
