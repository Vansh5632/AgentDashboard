-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgentBot" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "persona" TEXT NOT NULL,
    "elevenLabsVoiceId" TEXT NOT NULL,
    "phoneNumber" TEXT,
    "tenantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentBot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Credential" (
    "id" TEXT NOT NULL,
    "serviceName" TEXT NOT NULL,
    "encryptedValue" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Credential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallLog" (
    "id" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "summary" TEXT,
    "transcript" TEXT,
    "tenantId" TEXT NOT NULL,
    "customerPhoneNumber" TEXT,
    "agentId" TEXT,
    "agentPhoneNumber" TEXT,
    "callbackRequested" BOOLEAN NOT NULL DEFAULT false,
    "callbackScheduledAt" TIMESTAMP(3),
    "callbackReason" TEXT,
    "callbackAttempts" INTEGER NOT NULL DEFAULT 0,
    "callbackCompletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CallLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tenant_createdAt_idx" ON "Tenant"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_tenantId_idx" ON "User"("tenantId");

-- CreateIndex
CREATE INDEX "User_email_tenantId_idx" ON "User"("email", "tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentBot_phoneNumber_key" ON "AgentBot"("phoneNumber");

-- CreateIndex
CREATE INDEX "AgentBot_tenantId_idx" ON "AgentBot"("tenantId");

-- CreateIndex
CREATE INDEX "AgentBot_phoneNumber_idx" ON "AgentBot"("phoneNumber");

-- CreateIndex
CREATE INDEX "AgentBot_tenantId_createdAt_idx" ON "AgentBot"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "Credential_userId_idx" ON "Credential"("userId");

-- CreateIndex
CREATE INDEX "Credential_userId_serviceName_idx" ON "Credential"("userId", "serviceName");

-- CreateIndex
CREATE UNIQUE INDEX "CallLog_conversationId_key" ON "CallLog"("conversationId");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_idx" ON "CallLog"("tenantId");

-- CreateIndex
CREATE INDEX "CallLog_conversationId_idx" ON "CallLog"("conversationId");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_status_idx" ON "CallLog"("tenantId", "status");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_createdAt_idx" ON "CallLog"("tenantId", "createdAt");

-- CreateIndex
CREATE INDEX "CallLog_callbackScheduledAt_idx" ON "CallLog"("callbackScheduledAt");

-- CreateIndex
CREATE INDEX "CallLog_tenantId_callbackRequested_idx" ON "CallLog"("tenantId", "callbackRequested");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentBot" ADD CONSTRAINT "AgentBot_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Credential" ADD CONSTRAINT "Credential_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallLog" ADD CONSTRAINT "CallLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
