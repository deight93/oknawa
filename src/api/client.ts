import axios from 'axios';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const jsonHeaders = {
  'Content-Type': 'application/json',
};

export const api = axios.create({
  baseURL: SUPABASE_URL,
  timeout: 30000,
  headers: {
    ...jsonHeaders,
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
});

export const edgeApi = axios.create({
  baseURL: SUPABASE_URL,
  timeout: 30000,
  headers: {
    ...jsonHeaders,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  },
});
