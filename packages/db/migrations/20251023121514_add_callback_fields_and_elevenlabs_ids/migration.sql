-- AlterTable
ALTER TABLE "AgentBot" ADD COLUMN     "agentPhoneNumberId" TEXT,
ADD COLUMN     "elevenLabsAgentId" TEXT;

-- AlterTable
ALTER TABLE "CallLog" ADD COLUMN     "agentPhoneNumberId" TEXT,
ADD COLUMN     "callDuration" INTEGER,
ADD COLUMN     "finalState" TEXT,
ADD COLUMN     "leadStatus" TEXT;

-- CreateIndex
CREATE INDEX "AgentBot_elevenLabsAgentId_idx" ON "AgentBot"("elevenLabsAgentId");

-- CreateIndex
CREATE INDEX "CallLog_customerPhoneNumber_idx" ON "CallLog"("customerPhoneNumber");

-- CreateIndex
CREATE INDEX "CallLog_agentId_idx" ON "CallLog"("agentId");
