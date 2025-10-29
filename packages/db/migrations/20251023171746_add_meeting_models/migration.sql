-- CreateTable
CREATE TABLE "MeetingCredential" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "calcomApiKey" TEXT,
    "n8nAvailabilityWebhook" TEXT,
    "n8nBookingWebhook" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MeetingCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meeting" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerEmail" TEXT,
    "customerPhoneNumber" TEXT,
    "meetingTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "status" TEXT NOT NULL,
    "calcomEventId" TEXT,
    "conversationId" TEXT,
    "agentId" TEXT,
    "notes" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meeting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MeetingCredential_tenantId_key" ON "MeetingCredential"("tenantId");

-- CreateIndex
CREATE INDEX "MeetingCredential_tenantId_idx" ON "MeetingCredential"("tenantId");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_idx" ON "Meeting"("tenantId");

-- CreateIndex
CREATE INDEX "Meeting_conversationId_idx" ON "Meeting"("conversationId");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_status_idx" ON "Meeting"("tenantId", "status");

-- CreateIndex
CREATE INDEX "Meeting_tenantId_meetingTime_idx" ON "Meeting"("tenantId", "meetingTime");

-- CreateIndex
CREATE INDEX "Meeting_customerEmail_idx" ON "Meeting"("customerEmail");

-- AddForeignKey
ALTER TABLE "MeetingCredential" ADD CONSTRAINT "MeetingCredential_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meeting" ADD CONSTRAINT "Meeting_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
