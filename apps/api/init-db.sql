-- Database initialization script for AI Agent
-- This script runs when the PostgreSQL container starts for the first time

-- Create the database if it doesn't exist (this is usually handled by POSTGRES_DB)
-- But we can add any additional setup here

-- Create extensions if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- You can add any additional database setup here
-- For example, creating additional users, setting permissions, etc.

-- The Prisma migrations will handle the table creation
-- This file is just for any initial database setup

\echo 'Database initialization completed'