/*
  Warnings:

  - You are about to drop the column `contextPrompt` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the column `flag` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the column `learningObjective` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the column `owaspCategory` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the `Conversation` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LevelSolution` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Message` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Conversation" DROP CONSTRAINT "Conversation_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Conversation" DROP CONSTRAINT "Conversation_levelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Conversation" DROP CONSTRAINT "Conversation_userId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LevelSolution" DROP CONSTRAINT "LevelSolution_levelId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Message" DROP CONSTRAINT "Message_conversationId_fkey";

-- DropIndex
DROP INDEX "public"."Level_challengeId_index_idx";

-- AlterTable
ALTER TABLE "Level" DROP COLUMN "contextPrompt",
DROP COLUMN "flag",
DROP COLUMN "learningObjective",
DROP COLUMN "owaspCategory";

-- DropTable
DROP TABLE "public"."Conversation";

-- DropTable
DROP TABLE "public"."LevelSolution";

-- DropTable
DROP TABLE "public"."Message";

-- DropEnum
DROP TYPE "public"."ChatRole";

-- DropEnum
DROP TYPE "public"."ConversationStatus";
