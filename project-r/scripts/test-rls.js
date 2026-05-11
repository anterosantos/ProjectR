import { createClient } from '@supabase/supabase-js';
import process from 'node:process';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY; 
const USER_TOKEN = process.env.SUPABASE_USER_TOKEN;
const TABLE = process.env.SUPABASE_RLS_TABLE || 'profiles';
const USER_ID = process.env.SUPABASE_USER_ID;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !USER_TOKEN) {
  console.error('Missing environment variables.');
  console.error('Set SUPABASE_URL, SUPABASE_ANON_KEY and SUPABASE_USER_TOKEN before running.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: {
    headers: {
      Authorization: `Bearer ${USER_TOKEN}`, 
    },
  },
  auth: { persistSession: false },
});

async function run() {
  console.log('Running RLS verification against table:', TABLE);

  const selectAll = await supabase.from(TABLE).select('*').limit(20);
  console.log('\n1) SELECT *');
  console.log('status:', selectAll.status);
  console.log('error:', selectAll.error ? selectAll.error.message : 'none');
  console.log('rows returned:', Array.isArray(selectAll.data) ? selectAll.data.length : 0);

  if (USER_ID) {
    const selectSelf = await supabase.from(TABLE).select('*').eq('id', USER_ID).limit(1);
    console.log('\n2) SELECT own row by id');
    console.log('status:', selectSelf.status);
    console.log('error:', selectSelf.error ? selectSelf.error.message : 'none');
    console.log('rows returned:', Array.isArray(selectSelf.data) ? selectSelf.data.length : 0);
  }

  const fakeClubId = '00000000-0000-0000-0000-000000000000';
  const insertTest = await supabase.from(TABLE).insert([
    {
      id: '00000000-0000-0000-0000-000000000001',
      club_id: fakeClubId,
      // A linha do email foi removida daqui!
      role: 'player',
    },
  ]);
  console.log('\n3) INSERT with wrong club_id');
  console.log('status:', insertTest.status);
  console.log('error:', insertTest.error ? insertTest.error.message : 'none');
  console.log('insert data:', insertTest.data);

  console.log('\nRLS test complete.');
  process.exit(0);
}

run().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});