import { readFileSync } from 'fs';

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1maHBpd3djdG92bHRlaml6bm1yIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTQyMjA5MiwiZXhwIjoyMDk0OTk4MDkyfQ.J9Qz544OaA07oaF7ijyq52VjstEraGoPglKRGBJjp4U';
const BASE = 'https://mfhpiwwctovltejiznmr.supabase.co';

const headers = {
  'apikey': SERVICE_KEY,
  'Authorization': `Bearer ${SERVICE_KEY}`,
  'Content-Type': 'application/json',
  'Prefer': 'return=representation'
};

// Ler o SQL e executar via endpoint de query direto
const sql = readFileSync('./supabase/001_setup_inicial.sql', 'utf8');

const r = await fetch(`${BASE}/rest/v1/rpc/exec_sql_raw`, {
  method: 'POST',
  headers,
  body: JSON.stringify({ p_sql: sql })
});
const result = await r.text();
console.log('Status:', r.status, result.substring(0, 300));
