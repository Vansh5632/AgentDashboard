-- CreateTable
CREATE TABLE "AgentMapping" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentMapping_agentId_key" ON "AgentMapping"("agentId");

-- CreateIndex
CREATE INDEX "AgentMapping_agentId_idx" ON "AgentMapping"("agentId");

-- CreateIndex
CREATE INDEX "AgentMapping_tenantId_idx" ON "AgentMapping"("tenantId");

-- CreateIndex
CREATE INDEX "AgentMapping_userId_idx" ON "AgentMapping"("userId");

-- AddForeignKey
ALTER TABLE "AgentMapping" ADD CONSTRAINT "AgentMapping_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgentMapping" ADD CONSTRAINT "AgentMapping_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
