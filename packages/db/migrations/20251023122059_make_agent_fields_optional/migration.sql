/*
  Warnings:

  - A unique constraint covering the columns `[elevenLabsAgentId]` on the table `AgentBot` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "AgentBot" ALTER COLUMN "persona" DROP NOT NULL,
ALTER COLUMN "elevenLabsVoiceId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "AgentBot_elevenLabsAgentId_key" ON "AgentBot"("elevenLabsAgentId");
