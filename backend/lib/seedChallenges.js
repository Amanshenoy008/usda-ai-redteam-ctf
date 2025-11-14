// prisma/seed.js (ESM)
import { PrismaClient } from '../generated/prisma/index.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const prisma = new PrismaClient();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// If your Level model has hint1/hint2/hint3 columns and you want to populate them, set true
const USE_HINT_COLUMNS = false;

/* ------------------------------ helpers ------------------------------ */
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

/* ------------------------------ load JSON ------------------------------ */
const dataPath = path.resolve(__dirname, '../data/challenges.json');
if (!fs.existsSync(dataPath)) {
  console.error(`❌ Seed JSON not found at ${dataPath}`);
  process.exit(1);
}
const raw = fs.readFileSync(dataPath, 'utf-8');
const json = JSON.parse(raw);

// Optional auto-fix if someone put a root level accidentally
if (json?.challenges?.level3) {
  json.challenges.improper_output_handling ??= {};
  if (!json.challenges.improper_output_handling.level3) {
    json.challenges.improper_output_handling.level3 = json.challenges.level3;
  }
  delete json.challenges.level3;
}

/* ------------------------------ upserts ------------------------------ */
async function upsertChallenge({ slug, title }) {
  const existing = await prisma.challenge.findFirst({ where: { slug } });
  if (!existing) {
    return prisma.challenge.create({
      data: {
        slug,
        title,
        isActive: true,
        graderConfig: null, // challenge-wide config unused for now
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
  // Prefer any of these keys for system context
  const ctx =
    v.system_context ??
    v.systemContext ??
    v.context_prompt ??
    '';

  const solutions = Array.isArray(v.solutions) ? v.solutions : [];
  const hints = Array.isArray(v.hints) ? v.hints : [];

  // Extra metadata we keep in JSON column for the level
  const owasp_category = v.owasp_category || null;
  const learning_objective = v.learning_objective || null;
  const externalId = v.id || null;

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
    // Source of truth for system prompt
    systemContext: ctx,
    // Keep flags/solutions/metadata in JSON column
    graderConfig: {
      id: externalId,
      flag,
      solutions,
      owasp_category,
      learning_objective,
    },
  };

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

/* ------------------------------ main ------------------------------ */
async function main() {
  const families = json?.challenges || {};
  const familyKeys = Object.keys(families);
  if (!familyKeys.length) {
    console.warn('⚠️  No challenges found in JSON.');
    return;
  }

  for (const familyKey of familyKeys) {
    const levelsObj = families[familyKey];
    const levels = toIndexedLevels(levelsObj);
    if (!levels.length) continue;

    const slug = kebab(familyKey);     // e.g. "prompt_injection" -> "prompt-injection"
    const title = titleize(familyKey); // e.g. "Prompt Injection"

    const challenge = await upsertChallenge({ slug, title });

    // Upsert present levels
    const presentIndexes = new Set();
    for (const { index, v } of levels) {
      await upsertLevel({ challengeId: challenge.id, index, v });
      presentIndexes.add(index);
    }

    // Delete levels that are no longer present in JSON
    const existingLevels = await prisma.level.findMany({
      where: { challengeId: challenge.id },
      select: { id: true, index: true },
    });
    const toDelete = existingLevels.filter(l => !presentIndexes.has(l.index));
    if (toDelete.length) {
      await prisma.level.deleteMany({ where: { id: { in: toDelete.map(l => l.id) } } });
      console.log(`🧹 Removed ${toDelete.length} stale level(s) from "${slug}"`);
    }
  }

  console.log('✅ Seed complete');
}

/* ------------------------------ run ------------------------------ */
main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
