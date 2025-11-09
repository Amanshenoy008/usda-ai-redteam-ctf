// Controllers/challengesController.js
import dotenv from 'dotenv';
dotenv.config();

import { PrismaClient } from '../generated/prisma/index.js';
const prisma = new PrismaClient();

const { GoogleGenAI } = await import('@google/genai');

// ---------------- In-memory sessions (per user/challenge/level) ----------------
const SESSIONS = new Map(); // key -> { history: [{role:'USER'|'MODEL', content}], touchedAt: number }
const MAX_TURNS = 20;
const IDLE_MS = 30 * 60 * 1000;

setInterval(() => {
  const now = Date.now();
  for (const [k, v] of SESSIONS.entries()) {
    if (now - v.touchedAt > IDLE_MS) SESSIONS.delete(k);
  }
}, 5 * 60 * 1000);

const sessionKey = (userId, challengeId, levelId) => `${userId}::${challengeId}::${levelId}`;
function getSession(userId, challengeId, levelId) {
  const key = sessionKey(userId, challengeId, levelId);
  let s = SESSIONS.get(key);
  if (!s) {
    s = { history: [], touchedAt: Date.now() };
    SESSIONS.set(key, s);
  }
  return { key, s };
}
const touch = s => { s.touchedAt = Date.now(); };

// ---------------- helpers ----------------
const fillFlag = (s, flag) => String(s ?? '').replace(/\$\{flag\}/g, flag ?? '');

function toContents(history, userMessage, systemInstruction) {
  const contents = [];

  // Belt-and-suspenders: push system prompt as first message too,
  // in case the API's systemInstruction path is ignored by a client version.
  if (systemInstruction?.trim()) {
    contents.push({ role: 'user', parts: [{ text: `[SYSTEM INSTRUCTION]\n${systemInstruction}` }] });
  }

  for (const m of history) {
    contents.push({
      role: m.role === 'USER' ? 'user' : 'model',
      parts: [{ text: m.content }]
    });
  }

  if (userMessage?.trim()) {
    contents.push({ role: 'user', parts: [{ text: userMessage }] });
  }

  return contents;
}

async function callGemini({ systemInstruction, contents }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const ai = new GoogleGenAI({ apiKey });

  // We pass BOTH: systemInstruction (native) AND we also inserted it into contents.
  const resp = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    systemInstruction: systemInstruction ? { role: 'system', parts: [{ text: systemInstruction }] } : undefined,
    contents
  });

  return (typeof resp?.text === 'function') ? await resp.text() : (resp?.text ?? '');
}

async function getChallengeAndLevel(challengeSlug, levelIndex) {
  const challenge = await prisma.challenge.findFirst({
    where: { slug: challengeSlug, isActive: true },
    include: { levels: { where: { isActive: true } } },
  });
  if (!challenge) throw new Error(`Challenge not found: ${challengeSlug}`);

  const level = challenge.levels.find(l => l.index === Number(levelIndex));
  if (!level) throw new Error(`Level ${levelIndex} not found for ${challengeSlug}`);

  return { challenge, level };
}

async function awardXpAndMark(userId, level) {
  const xp = level.xpReward ?? 0;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.userLevelProgress.findUnique({
      where: { userId_levelId: { userId, levelId: level.id } },
    });

    if (existing?.completed) return;

    if (!existing) {
      await tx.userLevelProgress.create({
        data: {
          userId,
          levelId: level.id,
          completed: true,
          completedAt: new Date(),
          xpAwarded: xp,
        },
      });
    } else {
      await tx.userLevelProgress.update({
        where: { userId_levelId: { userId, levelId: level.id } },
        data: { completed: true, completedAt: new Date(), xpAwarded: xp },
      });
    }

    if (xp > 0) {
      await tx.user.update({
        where: { id: userId },
        data: { xpTotal: { increment: xp } },
      });
    }
  });

  return { xpAwarded: xp };
}

// ---------------- generic handler ----------------
async function genericHandler(req, res, next, challengeSlug) {
  try {
    // Body shape: { userId: "uid", level: 1, message?: "txt", submittedFlag?: "FLAG" }
    const userId = String(req.body?.userId || '').trim();
    const levelIndex = Number(req.body?.level);
    const message = req.body?.message ?? '';
    const submittedFlag = String(req.body?.submittedFlag || '').trim();

    if (!userId) return res.status(400).json({ error: 'userId is required in body' });
    if (!Number.isInteger(levelIndex) || levelIndex < 1)
      return res.status(400).json({ error: 'level is required (1..n)' });

    const { challenge, level } = await getChallengeAndLevel(challengeSlug, levelIndex);

    // Pull system prompt from DB (graderConfig)
    const cfg = level.graderConfig ?? {};
    const systemInstruction = fillFlag(cfg.context_prompt, cfg.flag);

    const { key, s } = getSession(userId, challenge.id, level.id);

    // If user submits a flag, check & award XP (no model call needed)
    if (submittedFlag) {
      const expected = String(cfg.flag || '').trim();
      if (expected && submittedFlag === expected) {
        const { xpAwarded } = await awardXpAndMark(userId, level);
        return res.json({
          status: 'passed',
          sessionKey: key,
          challengeSlug,
          level: level.index,
          xpAwarded,
          message: 'Flag correct. Congrats!'
        });
      }
      return res.status(200).json({ status: 'incorrect', sessionKey: key, message: 'Flag is incorrect.' });
    }

    // If no message, return metadata for client to display hints/intro
    if (!message) {
      touch(s);
      return res.json({
        status: 'ready',
        sessionKey: key,
        challenge: { slug: challenge.slug, title: challenge.title },
        level: {
          index: level.index,
          title: level.title,
          difficulty: level.difficulty,
          description: level.description,
        }
      });
    }

    // Chat path
    const contents = toContents(s.history, message, systemInstruction);
    const reply = await callGemini({ systemInstruction, contents });

    // Append/trim history
    s.history.push({ role: 'USER', content: message });
    s.history.push({ role: 'MODEL', content: reply });
    if (s.history.length > MAX_TURNS * 2) s.history.splice(0, s.history.length - MAX_TURNS * 2);
    touch(s);

    return res.json({
      sessionKey: key,
      challengeSlug,
      level: level.index,
      reply,
    });
  } catch (err) {
    console.error('[challenge handler error]', err);
    return next(err);
  }
}

// ---------------- Route exports (slugs must match your seed) ----------------
export const challenge1 = (req, res, next) => genericHandler(req, res, next, 'prompt-injection');
export const challenge2 = (req, res, next) => genericHandler(req, res, next, 'misinformation');
export const challenge3 = (req, res, next) => genericHandler(req, res, next, 'sensitive-information-disclosure');
export const challenge4 = (req, res, next) => genericHandler(req, res, next, 'improper-output-handling');
