-- AlterTable
ALTER TABLE "Meeting" ADD COLUMN     "calcomResponse" TEXT,
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "whatsappError" TEXT,
ADD COLUMN     "whatsappSent" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "whatsappSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MeetingCredential" ADD COLUMN     "ghlWhatsappWebhook" TEXT;

-- CreateIndex
CREATE INDEX "Meeting_customerPhoneNumber_idx" ON "Meeting"("customerPhoneNumber");

-- CreateIndex
CREATE INDEX "Meeting_whatsappSent_idx" ON "Meeting"("whatsappSent");
