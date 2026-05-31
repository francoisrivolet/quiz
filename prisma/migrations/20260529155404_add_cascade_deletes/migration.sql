-- DropForeignKey
ALTER TABLE "GameSession" DROP CONSTRAINT "GameSession_quizId_fkey";

-- DropForeignKey
ALTER TABLE "PlayerAnswer" DROP CONSTRAINT "PlayerAnswer_questionId_fkey";

-- AddForeignKey
ALTER TABLE "GameSession" ADD CONSTRAINT "GameSession_quizId_fkey" FOREIGN KEY ("quizId") REFERENCES "Quiz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerAnswer" ADD CONSTRAINT "PlayerAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE CASCADE ON UPDATE CASCADE;
