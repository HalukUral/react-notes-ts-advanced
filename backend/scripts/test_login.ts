// test_login.ts
const loginUrl = 'http://localhost:8000/api/auth/login';
const registerUrl = 'http://localhost:8000/api/auth/register';

const user = { username: 'quicktest', email: 'quicktest@example.com', password: 'password123' };

async function run() {
  try {
    // Try register (ignore failure)
    try {
      const r = await fetch(registerUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(user) });
      console.log('Register status', r.status);
      try { console.log('Register body', await r.json()); } catch {}
    } catch (e) { console.error('Register request error', e); }

    // Login
    const res = await fetch(loginUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: user.username, password: user.password }) });
    console.log('Login status', res.status);
    const body = await res.json().catch(() => null);
    console.log('Login body:', body);
  } catch (e) {
    console.error('Test error', e);
  }
}

run();
