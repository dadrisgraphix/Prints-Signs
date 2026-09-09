// js/supabase.js
const SUPABASE_URL = 'https://jxiuodnyzugrzgxedyge.supabase.co'; // Usually looks like https://[reference-id].supabase.co
const SUPABASE_ANON_KEY = 'sb_publishable_JnocJ2COWYCzHrR8TjREBw_iZ0tXnZM'; // Paste your full publishable key here

window.supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);