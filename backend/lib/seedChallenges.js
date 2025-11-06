import { PrismaClient } from '../generated/prisma/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Set to true only if your Level model actually has columns: hint1, hint2, hint3
const USE_HINT_COLUMNS = false;

// ---------- helpers ----------
function kebab(s) {
  return String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-');
}
function titleize(k) {
  return String(k)
    .replace(/[_\-]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}
function mapDifficulty(s) {
  const d = String(s || '').toUpperCase();
  if (d.includes('HARD')) return 'HARD';
  if (d.includes('MEDIUM')) return 'MEDIUM';
  return 'EASY';
}
function xpFor(d) {
  switch (d) {
    case 'HARD': return 150;
    case 'MEDIUM': return 100;
    default: return 50;
  }
}
function toIndexedLevels(levelsObj) {
  return Object.entries(levelsObj || {})
    .map(([k, v]) => {
      const m = k.match(/level(\d+)/i);
      return m ? { index: parseInt(m[1], 10), v } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index);
}

// ---------- load JSON ----------
const dataPath = path.resolve(__dirname, '../data/challenges.json');
const raw = fs.readFileSync(dataPath, 'utf-8');
const json = JSON.parse(raw);

// Auto-fix: if a stray root "level3" exists, fold it into improper_output_handling
if (json?.challenges?.level3) {
  json.challenges.improper_output_handling ??= {};
  if (!json.challenges.improper_output_handling.level3) {
    json.challenges.improper_output_handling.level3 = json.challenges.level3;
  }
  delete json.challenges.level3;
}

async function upsertChallenge({ slug, title }) {
  const existing = await prisma.challenge.findFirst({ where: { slug } });
  if (!existing) {
    return prisma.challenge.create({
      data: {
        slug,
        title,
        isActive: true,
        graderConfig: null, // challenge-wide config unused
      },
    });
  }
  return prisma.challenge.update({
    where: { id: existing.id },
    data: {
      title,
      isActive: true,
    },
  });
}

async function upsertLevel({ challengeId, index, v }) {
  const levelTitle = v.title || `Level ${index}`;
  const levelDesc = v.description || '';
  const levelDiff = mapDifficulty(v.difficulty);
  const flag = v.flag || '';
  const ctx = v.context_prompt || '';
  const solutions = Array.isArray(v.solutions) ? v.solutions : [];
  const hints = Array.isArray(v.hints) ? v.hints : [];

  const existing = await prisma.level.findFirst({
    where: { challengeId, index },
  });

  const baseData = {
    challengeId,
    index,
    title: levelTitle,
    description: levelDesc,
    difficulty: levelDiff,
    isActive: true,
    xpReward: xpFor(levelDiff),
    graderConfig: { flag, context_prompt: ctx, solutions },
  };

  // Optional: map to hint1/2/3 columns if you add them to the schema later
  const hintPatch = USE_HINT_COLUMNS
    ? { hint1: hints[0] ?? null, hint2: hints[1] ?? null, hint3: hints[2] ?? null }
    : {};

  if (!existing) {
    return prisma.level.create({ data: { ...baseData, ...hintPatch } });
  }
  return prisma.level.update({
    where: { id: existing.id },
    data: { ...baseData, ...hintPatch },
  });
}

async function main() {
  const families = json?.challenges || {};
  const familyKeys = Object.keys(families);

  for (const familyKey of familyKeys) {
    const levelsObj = families[familyKey];
    const levels = toIndexedLevels(levelsObj);
    if (!levels.length) continue;

    const slug = kebab(familyKey);         // e.g. "prompt_injection" -> "prompt-injection"
    const title = titleize(familyKey);     // e.g. "Prompt Injection"

    const challenge = await upsertChallenge({ slug, title });

    // Upsert levels present in JSON
    const presentIndexes = new Set();
    for (const { index, v } of levels) {
      await upsertLevel({ challengeId: challenge.id, index, v });
      presentIndexes.add(index);
    }

    // Delete stray levels not in JSON (e.g., old level 5)
    const existingLevels = await prisma.level.findMany({
      where: { challengeId: challenge.id },
      select: { id: true, index: true },
    });
    const toDelete = existingLevels.filter(l => !presentIndexes.has(l.index));
    if (toDelete.length) {
      await prisma.level.deleteMany({ where: { id: { in: toDelete.map(l => l.id) } } });
    }
  }

  console.log('✅ Seed complete');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
