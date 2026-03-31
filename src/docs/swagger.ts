export const swaggerDocument = {
  openapi: '3.0.0',
  info: {
    title: 'CogniScreen Backend API',
    version: '1.0.0',
    description: 'API documentation with edge cases and errors for the CogniScreen Dementia Early Detection System.',
  },
  servers: [{ url: 'http://localhost:5000' }],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
    }
  },
  security: [{ bearerAuth: [] }],
  paths: {
    '/api/auth/register': {
      post: {
        summary: 'Register a new user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  phone: { type: 'string' },
                  pin: { type: 'string' },
                  age: { type: 'number' },
                  education: { type: 'string', enum: ['none', 'primary', 'secondary', 'graduate'] },
                  livesAlone: { type: 'boolean' },
                  caregiverPhone: { type: 'string' },
                  caregiverEmail: { type: 'string' },
                },
                required: ['name', 'phone', 'pin', 'age', 'education']
              }
            }
          }
        },
        responses: {
          201: { description: 'Registration successful. Returns token and user data.' },
          400: { description: 'Phone number already registered' },
          500: { description: 'Registration failed' }
        }
      }
    },
    '/api/auth/login': {
      post: {
        summary: 'Login an existing user',
        security: [],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  phone: { type: 'string' },
                  pin: { type: 'string' }
                },
                required: ['phone', 'pin']
              }
            }
          }
        },
        responses: {
          200: { description: 'Login successful' },
          401: { description: 'Incorrect PIN' },
          404: { description: 'User not found' },
          500: { description: 'Login failed' }
        }
      }
    },
    '/api/auth/me': {
      get: {
        summary: 'Get current logged-in user details',
        responses: {
          200: { description: 'User retrieved successfully' },
          401: { description: 'Invalid or missing token' },
          404: { description: 'User not found' },
          500: { description: 'Error fetching user' }
        }
      }
    },
    '/api/sessions/game': {
      post: {
        summary: 'Submit a new game session',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  testType: { type: 'string', enum: ['memory_mosaic', 'word_garden', 'path_finder'] },
                  score: { type: 'number' },
                  timeTaken: { type: 'number' },
                  errors: { type: 'number' },
                  hesitationGaps: { type: 'array', items: { type: 'number' } }
                },
                required: ['testType', 'score', 'timeTaken']
              }
            }
          }
        },
        responses: {
          201: { description: 'Processing started in ML bull queue' },
          401: { description: 'Unauthorized' },
          404: { description: 'User not found' },
          500: { description: 'Failed to submit' }
        }
      },
      get: {
        summary: 'Get up to 20 recent game sessions for the user',
        responses: {
          200: { description: 'Returns an array of game sessions' },
          401: { description: 'Unauthorized' },
          500: { description: 'Failed to fetch sessions' }
        }
      }
    },
    '/api/sessions/game/{id}': {
      get: {
        summary: 'Poll for game session scoring status',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        responses: {
          200: { description: 'Returns { status: "processing" } or the final ML JSON results' },
          401: { description: 'Unauthorized' },
          404: { description: 'Session not found' },
          500: { description: 'Server Error' }
        }
      }
    },
    '/api/sessions/chat': {
      post: {
        summary: 'Submit a tracked conversation scoring profile to ML',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: {
          201: { description: 'Started processing ML evaluation' },
          401: { description: 'Unauthorized' },
          500: { description: 'Error submitting payload' }
        }
      }
    },
    '/api/sessions/webcam': {
      post: {
        summary: 'Submit physiological metrics gathered via webcam',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object' } } }
        },
        responses: {
          201: { description: 'Processing webcam session' },
          401: { description: 'Unauthorized' },
          500: { description: 'Failed to insert' }
        }
      }
    },
    '/api/chat/message': {
      post: {
        summary: 'Proxy endpoint connecting to Google Gemini AI backend (Warm companion)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  messages: { type: 'array', items: { type: 'object' }, description: 'Anthropic style message objects e.g {role: "user", content: "..."}' }
                }
              }
            }
          }
        },
        responses: {
          200: { description: 'Returns AI reply securely' },
          401: { description: 'Unauthorized' },
          500: { description: 'Failed chat generation request' }
        }
      }
    },
    '/api/tasks/today': {
      get: {
        summary: 'Fetch recommended personalized tasks today depending on AI risk stage',
        responses: {
          200: { description: 'Returns task array & completions' },
          401: { description: 'Unauthorized' },
          404: { description: 'User not found' },
          500: { description: 'Failed' }
        }
      }
    },
    '/api/tasks/complete': {
      put: {
        summary: 'Commit tasks completed for the day and increment streak',
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { tasksCompleted: { type: 'number' }, tasksTotal: { type: 'number' } }, required: ['tasksCompleted', 'tasksTotal'] } } }
        },
        responses: {
          200: { description: 'Updates user daily streak database log' },
          401: { description: 'Unauthorized' },
          500: { description: 'Database failed' }
        }
      }
    },
    '/api/tasks/grid': {
      get: {
        summary: 'Calculate tasks array for last 365 days (Github Contribution Style)',
        responses: {
          200: { description: 'Returns object map of dates and completion ratios e.g. "2026-03-30": 0.8' },
          401: { description: 'Unauthorized' },
          500: { description: 'Failed generating grid' }
        }
      }
    },
    '/api/dashboard': {
      get: {
        summary: 'Unified endpoint retrieving analytics charts (trends, histograms, latest risk snapshot)',
        responses: {
          200: { description: 'Complete analytics dataset' },
          401: { description: 'Unauthorized' },
          500: { description: 'Analytics engine failed resolving aggregate query' }
        }
      }
    },
    '/api/dashboard/reports/today': {
      get: {
        summary: 'Fetches today alone analytics and raw completed activity documents',
        responses: {
          200: { description: 'Raw sessions snapshot' },
          401: { description: 'Unauthorized' },
          500: { description: 'Query error' }
        }
      }
    },
    '/api/dashboard/reports/history': {
      get: {
        summary: 'Paginate historically across risk evaluation snapshots',
        parameters: [{ name: 'page', in: 'query', schema: { type: 'number' } }],
        responses: {
          200: { description: 'Pagination output mapped descending' },
          401: { description: 'Unauthorized' },
          500: { description: 'Failed fetching paginated result' }
        }
      }
    },
    '/api/caregiver': {
      get: {
        summary: 'Stub endpoint for caregiver portal logic',
        responses: {
          200: { description: 'Basic setup message' },
          401: { description: 'Unauthorized' }
        }
      }
    }
  }
}
