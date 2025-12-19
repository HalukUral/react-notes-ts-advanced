// test_register.ts
const url = 'http://localhost:8000/api/auth/register';
const payload = { username: 'testuser2', email: 'testuser2@example.com', password: 'password123' };

try {
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  console.log('Status:', r.status);
  try {
    const json = await r.json();
    console.log('Response body:', JSON.stringify(json, null, 2));
  } catch (e) {
    console.log('No JSON body');
  }

  // Now list users from DB
  try {
    const { orm } = await import('../db/drizzle.ts');
    const { users } = await import('../db/schema.ts');
    const rows = await orm.select().from(users).all();
    console.log('Users in DB:', JSON.stringify(rows, null, 2));
  } catch (e) {
    console.error('Error reading DB:', e);
  }
} catch (e) {
  console.error('Request error:', e);
}
