import mongoose, { Document, Schema } from 'mongoose'

export interface IUser extends Document {
  name: string
  phone: string
  pinHash: string
  age: number
  education: 'none' | 'primary' | 'secondary' | 'graduate'
  livesAlone: boolean
  caregiverPhone?: string
  caregiverEmail?: string
  createdAt: Date
}

const UserSchema = new Schema<IUser>({
  name:           { type: String, required: true },
  phone:          { type: String, required: true, unique: true },
  pinHash:        { type: String, required: true },
  age:            { type: Number, required: true },
  education:      { type: String, enum: ['none','primary','secondary','graduate'], required: true },
  livesAlone:     { type: Boolean, default: false },
  caregiverPhone: { type: String },
  caregiverEmail: { type: String },
}, { timestamps: true })

export default mongoose.model<IUser>('User', UserSchema)
