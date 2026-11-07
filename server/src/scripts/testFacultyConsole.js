const API_BASE = 'http://localhost:5000/api/v1';

async function testConsole() {
  console.log('Logging in as faculty...');
  const t0 = Date.now();
  const loginRes = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alan.turing@examsphere.io', password: 'Faculty@12345' }),
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  console.log(`Login took ${Date.now() - t0}ms`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  console.log('\nFetching /faculty/courses...');
  const t1 = Date.now();
  const coursesRes = await fetch(`${API_BASE}/faculty/courses`, { headers });
  const coursesData = await coursesRes.json();
  console.log(`/faculty/courses status ${coursesRes.status} in ${Date.now() - t1}ms`);
  console.log('Courses count:', coursesData.data?.length);

  console.log('\nFetching /exams...');
  const t2 = Date.now();
  const examsRes = await fetch(`${API_BASE}/exams?page=1&limit=10`, { headers });
  const examsData = await examsRes.json();
  console.log(`/exams status ${examsRes.status} in ${Date.now() - t2}ms`);
  console.log('Exams response keys:', Object.keys(examsData));
  console.log('data is array?', Array.isArray(examsData.data), 'length:', examsData.data?.length);
  console.log('pagination:', examsData.pagination);
  if (examsData.data?.length > 0) {
    console.log('Sample exam title:', examsData.data[0].title);
  }
}

testConsole().catch(console.error);
