-- AlterTable
ALTER TABLE "PlayerAnswer" ADD COLUMN     "wrongAttempts" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Question" ADD COLUMN     "allowMultipleAttempts" BOOLEAN NOT NULL DEFAULT false;
