-- CreateEnum
CREATE TYPE "ConversationChannel" AS ENUM ('WHATSAPP', 'WEB');

-- AlterTable
ALTER TABLE "conversations" ADD COLUMN     "channel" "ConversationChannel" NOT NULL DEFAULT 'WHATSAPP',
ADD COLUMN     "web_contact_name" TEXT,
ADD COLUMN     "web_visitor_id" TEXT,
ALTER COLUMN "wa_contact_id" DROP NOT NULL,
ALTER COLUMN "wa_contact_phone" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "conversations_tenant_id_channel_idx" ON "conversations"("tenant_id", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "conversations_tenant_id_web_visitor_id_key" ON "conversations"("tenant_id", "web_visitor_id");
