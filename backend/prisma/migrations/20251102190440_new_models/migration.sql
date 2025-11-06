/*
  Warnings:

  - You are about to drop the column `description` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `difficulty` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `familyId` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `revision` on the `Challenge` table. All the data in the column will be lost.
  - You are about to drop the column `revision` on the `Level` table. All the data in the column will be lost.
  - You are about to drop the column `attempts` on the `UserLevelProgress` table. All the data in the column will be lost.
  - You are about to drop the `ChallengeFamily` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Hint` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `LevelHint` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "public"."Challenge" DROP CONSTRAINT "Challenge_familyId_fkey";

-- DropForeignKey
ALTER TABLE "public"."Hint" DROP CONSTRAINT "Hint_challengeId_fkey";

-- DropForeignKey
ALTER TABLE "public"."LevelHint" DROP CONSTRAINT "LevelHint_levelId_fkey";

-- DropIndex
DROP INDEX "public"."Challenge_familyId_slug_key";

-- AlterTable
ALTER TABLE "Challenge" DROP COLUMN "description",
DROP COLUMN "difficulty",
DROP COLUMN "familyId",
DROP COLUMN "revision";

-- AlterTable
ALTER TABLE "Level" DROP COLUMN "revision",
ADD COLUMN     "hint1" TEXT,
ADD COLUMN     "hint2" TEXT,
ADD COLUMN     "hint3" TEXT;

-- AlterTable
ALTER TABLE "UserLevelProgress" DROP COLUMN "attempts";

-- DropTable
DROP TABLE "public"."ChallengeFamily";

-- DropTable
DROP TABLE "public"."Hint";

-- DropTable
DROP TABLE "public"."LevelHint";
