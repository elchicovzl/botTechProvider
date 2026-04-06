-- AlterTable
ALTER TABLE "tenants" ADD COLUMN "widget_api_key" TEXT,
ADD COLUMN "allowed_origins" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "tenants_widget_api_key_key" ON "tenants"("widget_api_key");
