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
const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

// Body Parser
app.use(express.json());

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
