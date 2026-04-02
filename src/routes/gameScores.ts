import express from 'express';
import mongoose from 'mongoose';
import { z } from 'zod';
import { verifyJWT, AuthRequest } from '../middleware/auth';
import GameScore from '../models/GameScore';

const router = express.Router();

const GameScoreSchema = z.object({
  gameId:       z.enum(['sequence','reaction','number','colorWord','wordScramble']),
  score:        z.number().min(0),
  errors:       z.number().min(0).default(0),
  level:        z.number().min(1).default(1),
  accuracy:     z.number().min(0).max(100).optional(),
  reactionTime: z.number().positive().optional(),
  duration:     z.number().positive().optional(),
});

// POST /api/game-scores
router.post('/', verifyJWT, async (req: AuthRequest, res: express.Response): Promise<any> => {
  try {
    const validated = GameScoreSchema.parse(req.body);
    const userId = req.userId;
    
    // Set date = today as YYYY-MM-DD string
    const date = new Date().toISOString().split('T')[0];
    
    const newScore = new GameScore({
      ...validated,
      userId,
      date,
    });
    
    await newScore.save();
    
    return res.status(201).json({
      id: newScore._id,
      gameId: newScore.gameId,
      score: newScore.score,
      errors: newScore.errors,
      date: newScore.date,
      message: 'Score saved'
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', error: error.errors });
    }
    return res.status(500).json({ message: 'Internal server error', error: error.message });
  }
});

// GET /api/game-scores/daily
router.get('/daily', verifyJWT, async (req: AuthRequest, res: express.Response): Promise<any> => {
  try {
    let days = parseInt(req.query.days as string) || 7;
    if (days > 30) days = 30;
    
    const userId = req.userId;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);
    
    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const scores = await GameScore.find({
      userId,
      date: { $gte: startDateStr, $lte: endDateStr }
    });

    // Generate labels
    const labels: string[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        labels.push(d.toISOString().split('T')[0]);
    }

    const defaultGameData = () => labels.map(date => ({
        date, bestScore: 0, totalErrors: 0, sessions: 0, avgAccuracy: undefined as number | undefined
    }));

    const gamesData: any = {
      sequence: defaultGameData(),
      reaction: defaultGameData(),
      number: defaultGameData(),
      colorWord: defaultGameData(),
      wordScramble: defaultGameData()
    };

    // Grouping
    scores.forEach(score => {
      const idx = labels.indexOf(score.date);
      if (idx !== -1) {
        const game = gamesData[score.gameId][idx];
        game.sessions++;
        game.totalErrors += score.errors;
        if (score.score > game.bestScore) {
          game.bestScore = score.score;
        }
        if (score.accuracy !== undefined) {
           game.avgAccuracy = game.avgAccuracy === undefined 
             ? score.accuracy 
             : ((game.avgAccuracy * (game.sessions - 1)) + score.accuracy) / game.sessions;
        }
      }
    });

    return res.status(200).json({
      labels,
      games: gamesData
    });
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch daily scores', error: error.message });
  }
});

// GET /api/game-scores/summary
router.get('/summary', verifyJWT, async (req: AuthRequest, res: express.Response): Promise<any> => {
  try {
    const userId = req.userId;
    const summary = await GameScore.aggregate([
      { $match: { userId: new mongoose.Types.ObjectId(userId) } },
      { $group: {
          _id: "$gameId",
          totalSessions: { $sum: 1 },
          bestScore: { $max: "$score" },
          avgScore: { $avg: "$score" },
          totalErrors: { $sum: "$errors" },
          lastPlayed: { $max: "$date" },
          avgReactionTime: { $avg: "$reactionTime" }
      }}
    ]);

    const result: any = {
        sequence: { totalSessions: 0, bestScore: 0, avgScore: 0, totalErrors: 0 },
        reaction: { totalSessions: 0, bestScore: 0, avgScore: 0, totalErrors: 0 },
        number: { totalSessions: 0, bestScore: 0, avgScore: 0, totalErrors: 0 },
        colorWord: { totalSessions: 0, bestScore: 0, avgScore: 0, totalErrors: 0 },
        wordScramble: { totalSessions: 0, bestScore: 0, avgScore: 0, totalErrors: 0 }
    };
    
    summary.forEach(item => {
        result[item._id] = {
            totalSessions: item.totalSessions,
            bestScore: item.bestScore,
            avgScore: item.avgScore,
            totalErrors: item.totalErrors,
            lastPlayed: item.lastPlayed
        };
        if (item._id === 'reaction' && item.avgReactionTime !== null) {
            result[item._id].avgReactionTime = item.avgReactionTime;
        }
    });
    
    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch summary', error: error.message });
  }
});

// GET /api/game-scores/today
router.get('/today', verifyJWT, async (req: AuthRequest, res: express.Response): Promise<any> => {
  try {
    const userId = req.userId;
    const today = new Date().toISOString().split('T')[0];
    
    const scores = await GameScore.find({ userId, date: today });
    
    const result: any = {
        sequence: null,
        reaction: null,
        number: null,
        colorWord: null,
        wordScramble: null
    };

    scores.forEach(score => {
        if (!result[score.gameId] || score.score > result[score.gameId].score) {
            result[score.gameId] = {
                score: score.score,
                errors: score.errors,
                ...(score.accuracy !== undefined && { accuracy: score.accuracy }),
                ...(score.reactionTime !== undefined && { reactionTime: score.reactionTime }),
            };
        }
    });

    return res.status(200).json(result);
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch today scores', error: error.message });
  }
});

// GET /api/game-scores/trend/:gameId
router.get('/trend/:gameId', verifyJWT, async (req: AuthRequest, res: express.Response): Promise<any> => {
  try {
    const { gameId } = req.params;
    let days = parseInt(req.query.days as string) || 14;
    if (days > 30) days = 30;
    
    const userId = req.userId;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - days + 1);

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    const scores = await GameScore.find({
      userId,
      gameId,
      date: { $gte: startDateStr, $lte: endDateStr }
    });

    const trend: any[] = [];
    for (let i = 0; i < days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        const dateStr = d.toISOString().split('T')[0];
        const dateFormatted = `${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
        
        const dayScores = scores.filter(s => s.date === dateStr);
        if (dayScores.length > 0) {
            let bestScore = -1;
            let errorsForBest = 0;
            dayScores.forEach(s => {
                if (s.score > bestScore) {
                    bestScore = s.score;
                    errorsForBest = s.errors;
                }
            });
            trend.push({ date: dateFormatted, score: bestScore, errors: errorsForBest });
        } else {
            trend.push({ date: dateFormatted, score: 0, errors: 0 });
        }
    }

    return res.status(200).json(trend);
  } catch (error: any) {
    return res.status(500).json({ message: 'Failed to fetch trend', error: error.message });
  }
});

export default router;
