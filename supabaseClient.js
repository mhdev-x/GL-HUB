// ========================================================
// CONFIGURATION SUPABASE — GL HUB
// La clé "anon public" est faite pour être utilisée côté
// client (navigateur) : ce n'est PAS un secret à cacher.
// ========================================================

const SUPABASE_URL = "https://ylhxyrpnzcbrxwdgriiu.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsaHh5cnBuemNicnh3ZGdyaWl1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODczNDQzNTQsImV4cCI6MjEwMjkyMDM1NH0.FgHDY3zBiBwsH9T-PX2PIb9kBgBHa-_yfB6APYmoX3E";

// Client global réutilisé par auth.js et par le script de garde sur chaque page
let supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);