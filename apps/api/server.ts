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

// CORS Configuration - TEMPORARILY ALLOWING ALL ORIGINS
console.log('🔐 CORS Configuration: ALLOWING ALL ORIGINS');
console.log('  Node Environment:', process.env.NODE_ENV);

app.use(cors({
  origin: true, // Allow all origins
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
