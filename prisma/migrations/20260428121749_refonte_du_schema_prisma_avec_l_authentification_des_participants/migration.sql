/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `participants` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[activationToken]` on the table `participants` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "ParticipantStatus" AS ENUM ('PENDING', 'ACTIVE');

-- CreateEnum
CREATE TYPE "ScanMode" AS ENUM ('ONLINE', 'OFFLINE');

-- AlterEnum
ALTER TYPE "EmailType" ADD VALUE 'ACCOUNT_ACTIVATION';

-- AlterTable
ALTER TABLE "participants" ADD COLUMN     "activationExpiresAt" TIMESTAMP(3),
ADD COLUMN     "activationToken" TEXT,
ADD COLUMN     "avatarUrl" TEXT,
ADD COLUMN     "password" TEXT,
ADD COLUMN     "status" "ParticipantStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "scan_logs" ADD COLUMN     "mode" "ScanMode" NOT NULL DEFAULT 'ONLINE';

-- AlterTable
ALTER TABLE "tickets" ADD COLUMN     "addedByOrganizer" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "participant_refresh_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceId" TEXT,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "participantId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "participant_refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "participant_refresh_tokens_token_key" ON "participant_refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "participant_refresh_tokens_participantId_idx" ON "participant_refresh_tokens"("participantId");

-- CreateIndex
CREATE INDEX "participant_refresh_tokens_token_idx" ON "participant_refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "participant_refresh_tokens_expiresAt_idx" ON "participant_refresh_tokens"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "participants_email_key" ON "participants"("email");

-- CreateIndex
CREATE UNIQUE INDEX "participants_activationToken_key" ON "participants"("activationToken");

-- CreateIndex
CREATE INDEX "participants_activationToken_idx" ON "participants"("activationToken");

-- CreateIndex
CREATE INDEX "scan_logs_mode_idx" ON "scan_logs"("mode");

-- AddForeignKey
ALTER TABLE "participant_refresh_tokens" ADD CONSTRAINT "participant_refresh_tokens_participantId_fkey" FOREIGN KEY ("participantId") REFERENCES "participants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
