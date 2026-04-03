import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import rateLimit from 'express-rate-limit'
import { z } from 'zod'
import User from '../models/User'
import { verifyJWT, AuthRequest } from '../middleware/auth'

const router = express.Router()

// ── Zod validation schemas ──
const RegisterSchema = z.object({
  name: z.string().min(1),
  phone: z.string().min(10),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
  age: z.number().int().min(1),
  education: z.string().optional(),
  livesAlone: z.boolean().optional(),
  caregiverPhone: z.string().optional(),
  caregiverEmail: z.string().email().optional().or(z.literal('')),
})

const LoginSchema = z.object({
  phone: z.string().min(1),
  pin: z.string().regex(/^\d{4}$/, 'PIN must be exactly 4 digits'),
})

// ── Rate limiter for login ──
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // max 10 attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
})

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, phone, pin, age, education, livesAlone, caregiverPhone, caregiverEmail } = RegisterSchema.parse(req.body)

    const existing = await User.findOne({ phone })
    if (existing) return res.status(400).json({ message: 'Phone number already registered' })

    const pinHash = await bcrypt.hash(pin, 10)

    const user = await User.create({
      name, phone, pinHash, age, education,
      livesAlone: livesAlone || false,
      caregiverPhone, caregiverEmail
    })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
    })

    res.status(201).json({ token, userId: user._id, name: user.name, age: user.age })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors })
    }
    console.log(err)
    res.status(500).json({ message: 'Registration failed', error: err })
  }
})

// POST /api/auth/login  (rate-limited)
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const { phone, pin } = LoginSchema.parse(req.body)

    const user = await User.findOne({ phone })
    if (!user) return res.status(404).json({ message: 'User not found' })

    const isValid = await bcrypt.compare(pin, user.pinHash)
    if (!isValid) return res.status(401).json({ message: 'Incorrect PIN' })

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET!, {
      expiresIn: (process.env.JWT_EXPIRES_IN || '7d') as any
    })

    res.json({ token, userId: user._id, name: user.name, age: user.age })
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation failed', errors: err.errors })
    }
    res.status(500).json({ message: 'Login failed', error: err })
  }
})

// GET /api/auth/me — protected
router.get('/me', verifyJWT, async (req: AuthRequest, res) => {
  try {
    const user = await User.findById(req.userId).select('-pinHash')
    if (!user) return res.status(404).json({ message: 'User not found' })
    res.json(user)
  } catch (err) {
    res.status(500).json({ message: 'Error fetching user', error: err })
  }
})

export default router
