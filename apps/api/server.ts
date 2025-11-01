// apps/api/server.ts
import express, { Express, Request, Response } from "express";
import cors from "cors";
import { PrismaClient } from "@ai_agent/db";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: "../../.env" });

// Import routes
import authRouter from "./routes/auth";
import userRouter from "./routes/user";
import webhookRouter from './routes/webhooks';
import meetingsRouter from './routes/meetings';
import callsRouter from './routes/calls';

const prisma = new PrismaClient();
const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS Configuration
const allowedOrigins = process.env.CORS_ORIGINS?.split(',').map(origin => origin.trim()) || [
  'http://localhost:3000',
  'https://web-production-af51.up.railway.app'
];

console.log('🔐 CORS Configuration:');
console.log('  Allowed Origins:', allowedOrigins);
console.log('  Node Environment:', process.env.NODE_ENV);

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) {
      console.log('✅ CORS: Allowing request with no origin');
      return callback(null, true);
    }
    
    // In development, allow all origins
    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ CORS: Allowing ${origin} (development mode)`);
      return callback(null, true);
    }
    
    // Check if origin is in allowed list or matches Railway pattern
    if (allowedOrigins.includes(origin) || origin.includes('.railway.app')) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`❌ CORS: Blocking origin: ${origin}`);
      // Don't throw error - just reject the origin but allow the request to proceed
      // This prevents the preflight from failing completely
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours - cache preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Body Parser
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
  next();
});

// Public Routes
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok" });
});

// API Routes
app.use("/api", authRouter);
app.use("/api", userRouter);
app.use("/api",webhookRouter);
app.use("/api", meetingsRouter);
app.use("/api", callsRouter);

// Start the server
app.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
