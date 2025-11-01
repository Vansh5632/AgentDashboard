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

// CORS Configuration - Load from environment variable or use defaults
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'https://web-production-af51.up.railway.app',
      'http://localhost:3000', // for local development
      'http://localhost:3001'
    ];

console.log('🔐 CORS Configuration:');
console.log('  Allowed Origins:', allowedOrigins);
console.log('  Node Environment:', process.env.NODE_ENV);

// CORS options configuration
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if the origin is in our allowed list
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log(`✅ CORS: Allowing origin: ${origin}`);
      callback(null, true);
    } else {
      console.warn(`⚠️  CORS: Blocking origin: ${origin}`);
      // CRITICAL: Don't throw error - just return false
      // This allows preflight to complete with proper headers
      callback(null, false);
    }
  },
  credentials: true, // Allow cookies to be sent
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'X-Request-Id'],
  maxAge: 86400, // 24 hours - cache preflight requests
  preflightContinue: false,
  optionsSuccessStatus: 204
};

// Use the CORS middleware *before* your routes
app.use(cors(corsOptions));

// Body Parser
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path} - Origin: ${req.get('origin') || 'none'}`);
  next();
});

// Handle preflight OPTIONS requests explicitly
// This ensures CORS headers are properly set for all OPTIONS requests
// Note: Using middleware instead of app.options("*") for Express 5.x compatibility
app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    console.log(`📋 OPTIONS preflight request for: ${req.path}`);
    console.log(`   Origin: ${req.get('origin') || 'none'}`);
    // CORS middleware already set the headers, just return 204
    return res.status(204).end();
  }
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
