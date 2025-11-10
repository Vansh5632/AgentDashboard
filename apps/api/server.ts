// apps/api/server.ts
import express, { Express, Request, Response } from "express";
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
import timeRouter from './routes/time';
import agentsRouter from './routes/agents';

const prisma = new PrismaClient();
const app: Express = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// CORS Configuration
// Get allowed frontend origin from environment variable
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN;
const isDevelopment = process.env.NODE_ENV !== 'production';

console.log('🔐 CORS Configuration:');
console.log('  Environment:', process.env.NODE_ENV || 'development');
console.log('  Frontend Origin:', FRONTEND_ORIGIN || 'Not set (allowing all in dev)');

// Custom CORS middleware
app.use((req: Request, res: Response, next) => {
  const origin = req.get('origin');
  
  // Determine if origin is allowed
  let allowOrigin = false;
  
  if (!origin) {
    // No origin header (e.g., Postman, curl, mobile apps) - allow
    allowOrigin = true;
  } else if (isDevelopment && !FRONTEND_ORIGIN) {
    // Development mode without explicit FRONTEND_ORIGIN - allow all
    allowOrigin = true;
    console.log(`✅ CORS [DEV]: Allowing origin: ${origin}`);
  } else if (FRONTEND_ORIGIN && origin === FRONTEND_ORIGIN) {
    // Production or explicit FRONTEND_ORIGIN set - validate exact match
    allowOrigin = true;
    console.log(`✅ CORS: Allowing origin: ${origin}`);
  } else {
    // Origin not allowed
    console.warn(`❌ CORS: Blocking origin: ${origin}`);
    console.warn(`   Expected origin: ${FRONTEND_ORIGIN || 'Not configured'}`);
  }
  
  // Set CORS headers if origin is allowed
  if (allowOrigin && origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
  }
  
  // Handle preflight OPTIONS request
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  
  next();
});

// Body Parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use((req, res, next) => {
  const origin = req.get('origin') || 'no-origin';
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Origin: ${origin}`);
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
app.use("/api", timeRouter);
app.use("/api", agentsRouter);

// Start the server
app.listen(PORT,'0.0.0.0', () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});
