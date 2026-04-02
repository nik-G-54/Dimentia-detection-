import express from 'express'
import cors from 'cors'
import mongoose from 'mongoose'
import dotenv from 'dotenv'

import swaggerUi from 'swagger-ui-express'
import { swaggerDocument } from './docs/swagger'

import authRoutes from './routes/auth'
import sessionRoutes from './routes/sessions'
import chatRoutes from './routes/chat'
import taskRoutes from './routes/tasks'
import dashboardRoutes from './routes/dashboard'
import caregiverRoutes from './routes/caregiver'
import gameScoreRoutes from './routes/gameScores'

// Import worker so it starts listening when server starts
import './jobs/scoreWorker'

dotenv.config()

const app = express()

// Configure CORS universally to allow all origins
const corsOptions = {
  origin: (origin: any, callback: any) => {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.use(express.json())

// Mount all routes 
app.use('/api/auth', authRoutes)
app.use('/api/sessions', sessionRoutes)
app.use('/api/chat', chatRoutes)
app.use('/api/tasks', taskRoutes)
app.use('/api/dashboard', dashboardRoutes)
app.use('/api/caregiver', caregiverRoutes)
app.use('/api/game-scores', gameScoreRoutes)

// Setup Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

// Health check — useful for demo
app.get('/health', (req, res) => res.json({ status: 'ok', service: 'CogniScreen Backend' }))

// Connect to MongoDB then start server
mongoose.connect(process.env.MONGODB_URI!)
  .then(() => {
    console.log('✅ MongoDB connected')
    app.listen(process.env.PORT || 5000, () => {
      console.log(`✅ Server running on port ${process.env.PORT || 5000}`)
    })
  })
  .catch((err) => {
    console.error('❌ MongoDB connection failed:', err)
    process.exit(1)
  })

export default app
