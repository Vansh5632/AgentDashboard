// Health check endpoint for Docker health checks
import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json(
    { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      service: 'ai-agent-web'
    },
    { status: 200 }
  );
}