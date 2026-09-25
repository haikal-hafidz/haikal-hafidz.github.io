import { supabase } from './supabaseClient';

const readLastSubmit = (key) => {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
};

const rememberSubmit = (key) => {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* optional */ }
};

const normalizeScore = (row) => ({
  id: row.id,
  gameId: row.game_id || 'red-pen',
  playerId: row.player_id || null,
  playerName: row.player_name || 'Anonymous',
  score: Number(row.score) || 0,
  accuracy: Number(row.accuracy) || 0,
  correctCount: Number(row.correct_count) || 0,
  totalQuestions: Number(row.total_questions) || Number(row.total) || 1,
  attempts: Number(row.attempts) || 1,
  activeSeconds: Number(row.active_seconds) || 0,
  createdAt: row.created_at,
  updatedAt: row.updated_at || row.created_at,
});

const getPlayerId = () => {
  const key = 'portfolio_minigame_player_id';
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const next = globalThis.crypto?.randomUUID?.() || `player-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, next);
    return next;
  } catch {
    return `session-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }
};

const cleanPlayerName = (value) => String(value || '').trim().replace(/\s+/g, ' ').slice(0, 24);


export async function submitZine(body) {
  const clean = String(body || '').trim();
  if (!clean) throw new Error('Tulisan masih kosong.');
  if (clean.length > 5000) throw new Error('Tulisan terlalu panjang.');
  if (Date.now() - readLastSubmit('portfolio_last_zine_submit') < 30_000) {
    throw new Error('Tunggu sebentar sebelum mengirim tulisan lain.');
  }
  const { error } = await supabase.from('zine_submissions').insert({ body: clean, status: 'pending' });
  if (error) throw error;
  rememberSubmit('portfolio_last_zine_submit');
}

export async function getApprovedZines(limit = 100) {
  const { data, error } = await supabase
    .from('zine_submissions')
    .select('id, body, created_at')
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data || []).map((row) => ({
    id: `community-${row.id}`,
    label: 'Zine for a stranger',
    title: 'From another reader',
    author: 'Anonymous',
    body: row.body,
    createdAt: row.created_at,
  }));
}

export async function submitMiniGameScore(payload, legacyTotal) {
  // Backward-compatible with the old submitMiniGameScore(score, total) call.
  if (typeof payload === 'number') {
    const cleanScore = Number(payload);
    const cleanTotal = Number(legacyTotal);
    if (!Number.isInteger(cleanScore) || !Number.isInteger(cleanTotal) || cleanScore < 0 || cleanTotal < 1) throw new Error('Skor tidak valid.');
    const { error } = await supabase.from('mini_game_scores').insert({ score: cleanScore, total: cleanTotal });
    if (error) throw error;
    return null;
  }

  const gameId = String(payload?.gameId || 'red-pen').trim().slice(0, 40);
  const playerName = cleanPlayerName(payload?.playerName);
  const playerId = getPlayerId();
  const score = Math.max(0, Math.round(Number(payload?.score) || 0));
  const accuracy = Math.min(100, Math.max(0, Math.round(Number(payload?.accuracy) || 0)));
  const correctCount = Math.max(0, Math.round(Number(payload?.correctCount) || 0));
  const totalQuestions = Math.max(1, Math.round(Number(payload?.totalQuestions) || 1));
  const activeSeconds = Math.max(0, Math.round(Number(payload?.activeSeconds) || 0));

  if (playerName.length < 2) throw new Error('Nama / alias minimal 2 karakter.');
  if (!gameId) throw new Error('Game tidak valid.');

  // One row per browser/player per game. Supabase RPC performs the atomic
  // personal-best update; direct public UPDATE access stays closed by RLS.
  const { error: writeError } = await supabase.rpc('submit_minigame_score', {
    p_game_id: gameId,
    p_player_id: playerId,
    p_player_name: playerName,
    p_score: score,
    p_accuracy: accuracy,
    p_correct_count: correctCount,
    p_total_questions: totalQuestions,
    p_active_seconds: activeSeconds,
  });
  if (writeError) throw writeError;

  rememberSubmit('portfolio_last_score_submit');

  const { data: ranked, error: rankError } = await supabase
    .from('mini_game_scores')
    .select('id, game_id, player_id, player_name, score, accuracy, correct_count, total_questions, attempts, active_seconds, created_at, updated_at')
    .eq('game_id', gameId)
    .order('score', { ascending: false })
    .order('accuracy', { ascending: false })
    .order('active_seconds', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(1000);
  if (rankError) throw rankError;

  const rows = (ranked || []).map(normalizeScore);
  const index = rows.findIndex((item) => item.playerId === playerId);
  const mine = index >= 0 ? rows[index] : { playerId, playerName, score, accuracy, correctCount, totalQuestions, activeSeconds, attempts: 1 };
  return { ...mine, rank: index >= 0 ? index + 1 : null, totalPlayers: rows.length };
}

export async function getMiniGameLeaderboard(gameId = 'red-pen', limit = 10) {
  // Backward-compatible with getMiniGameLeaderboard(10).
  if (typeof gameId === 'number') {
    limit = gameId;
    gameId = 'red-pen';
  }
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 10));
  const { data, error } = await supabase
    .from('mini_game_scores')
    .select('id, game_id, player_id, player_name, score, accuracy, correct_count, total_questions, attempts, active_seconds, created_at, updated_at')
    .eq('game_id', String(gameId || 'red-pen'))
    .order('score', { ascending: false })
    .order('accuracy', { ascending: false })
    .order('active_seconds', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return (data || []).map(normalizeScore);
}

export async function getZineModerationQueue() {
  const { data, error } = await supabase
    .from('zine_submissions')
    .select('id, body, status, created_at, cms_archived')
    .eq('cms_archived', false)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function moderateZineSubmission(id, patch) {
  const safePatch = {};
  if (typeof patch.body === 'string') safePatch.body = patch.body.trim();
  if (['pending', 'approved', 'rejected'].includes(patch.status)) safePatch.status = patch.status;
  const { data, error } = await supabase
    .from('zine_submissions')
    .update(safePatch)
    .eq('id', id)
    .select('id, body, status, created_at, cms_archived')
    .single();
  if (error) throw error;
  return data;
}

export async function archiveZineSubmissions(ids) {
  const cleanIds = [...new Set((Array.isArray(ids) ? ids : [ids]).filter((id) => id !== null && id !== undefined))];
  if (!cleanIds.length) return [];
  const { data, error } = await supabase
    .from('zine_submissions')
    .update({ cms_archived: true })
    .in('id', cleanIds)
    .neq('status', 'pending')
    .select('id, status, cms_archived');
  if (error) throw error;
  return data || [];
}


export async function getMiniGameLeaderboardAdmin(limit = 500) {
  const safeLimit = Math.min(1000, Math.max(1, Number(limit) || 500));
  const { data, error } = await supabase
    .from('mini_game_scores')
    .select('id, game_id, player_id, player_name, score, accuracy, correct_count, total_questions, attempts, active_seconds, created_at, updated_at')
    .order('game_id', { ascending: true })
    .order('score', { ascending: false })
    .order('accuracy', { ascending: false })
    .order('active_seconds', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(safeLimit);
  if (error) throw error;
  return (data || []).map(normalizeScore);
}

export async function deleteMiniGameLeaderboardEntry(id) {
  if (id === null || id === undefined || id === '') throw new Error('ID leaderboard tidak valid.');
  const { error } = await supabase.rpc('delete_minigame_leaderboard_entry', { p_id: id });
  if (error) throw error;
}
