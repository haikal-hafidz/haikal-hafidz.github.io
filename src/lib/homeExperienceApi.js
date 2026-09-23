import { supabase } from './supabaseClient';

const readLastSubmit = (key) => {
  try { return Number(localStorage.getItem(key)) || 0; } catch { return 0; }
};

const rememberSubmit = (key) => {
  try { localStorage.setItem(key, String(Date.now())); } catch { /* optional */ }
};

const normalizeScore = (row) => ({
  id: row.id,
  score: Number(row.score) || 0,
  total: Number(row.total) || 1,
  createdAt: row.created_at,
});

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

export async function submitMiniGameScore(score, total) {
  const cleanScore = Number(score);
  const cleanTotal = Number(total);
  if (!Number.isInteger(cleanScore) || !Number.isInteger(cleanTotal) || cleanScore < 0 || cleanTotal < 1 || cleanTotal > 100 || cleanScore > cleanTotal) {
    throw new Error('Skor tidak valid.');
  }
  if (Date.now() - readLastSubmit('portfolio_last_score_submit') < 5_000) return;
  const { error } = await supabase.from('mini_game_scores').insert({ score: cleanScore, total: cleanTotal });
  if (error) throw error;
  rememberSubmit('portfolio_last_score_submit');
}

export async function getMiniGameLeaderboard(limit = 10) {
  const { data, error } = await supabase
    .from('mini_game_scores')
    .select('id, score, total, created_at')
    .order('score', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(limit);
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
