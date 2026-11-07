import { spawn } from 'child_process';

const EDGE_PATH = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

async function inspect() {
  const edge = spawn(EDGE_PATH, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--user-data-dir=C:\\Users\\user\\.gemini\\antigravity-ide\\brain\\dd042761-74d5-4145-b61e-9c0e5fc2d245\\scratch\\edge-user-data',
    '--no-first-run',
    '--no-default-browser-check',
    'http://localhost:5173/admin'
  ]);

  edge.stderr.on('data', d => {});

  // Wait for port 9222
  let wsUrl = null;
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 300));
    try {
      const res = await fetch('http://localhost:9222/json/list');
      const tabs = await res.json();
      const pageTab = tabs.find(t => t.type === 'page' && t.webSocketDebuggerUrl);
      if (pageTab) {
        wsUrl = pageTab.webSocketDebuggerUrl;
        break;
      }
    } catch {}
  }

  if (!wsUrl) {
    console.error('Could not connect to Edge debugger');
    edge.kill();
    return;
  }

  const ws = new WebSocket(wsUrl);

  await new Promise(resolve => ws.onopen = resolve);

  let id = 1;
  function send(method, params = {}) {
    ws.send(JSON.stringify({ id: id++, method, params }));
  }

  const consoleLogs = [];
  const networkRequests = [];

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const args = (msg.params.args || []).map(a => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleLogs.push(`[CONSOLE ${msg.params.type.toUpperCase()}] ${args}`);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      consoleLogs.push(`[EXCEPTION] ${msg.params.exceptionDetails?.text} ${msg.params.exceptionDetails?.exception?.description || ''}`);
    } else if (msg.method === 'Network.requestWillBeSent') {
      networkRequests.push(`${msg.params.request.method} ${msg.params.request.url}`);
    }
  };

  send('Runtime.enable');
  send('Page.enable');
  send('Network.enable');

  // Login as admin via API first to get a real token
  const loginRes = await fetch('http://localhost:5000/api/v1/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@examsphere.io', password: 'Admin@12345' })
  });
  const loginData = await loginRes.json();
  const token = loginData.data.accessToken;
  const refreshToken = loginData.data.refreshToken;
  const user = JSON.stringify(loginData.data.user);

  console.log('Logged in via API. Token obtained for role:', loginData.data.user.role);

  // Set tokens in browser localStorage and navigate to /admin
  send('Runtime.evaluate', {
    expression: `
      localStorage.setItem('examsphere_token', ${JSON.stringify(token)});
      localStorage.setItem('examsphere_refresh_token', ${JSON.stringify(refreshToken)});
      localStorage.setItem('examsphere_user', ${JSON.stringify(user)});
      window.location.href = '/admin';
    `
  });

  // Wait 4 seconds for page to render and execute
  await new Promise(r => setTimeout(r, 4000));

  // Get outer HTML of #root
  send('Runtime.evaluate', { expression: 'document.getElementById("root")?.innerHTML || document.body.innerHTML' });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.result?.result?.value) {
      console.log('--- ROOT HTML ---');
      console.log(msg.result.result.value.slice(0, 1000));
    }
  };

  await new Promise(r => setTimeout(r, 1000));

  console.log('\n--- CONSOLE LOGS & EXCEPTIONS ---');
  consoleLogs.forEach(l => console.log(l));

  console.log('\n--- NETWORK REQUESTS ---');
  networkRequests.slice(0, 20).forEach(r => console.log(r));

  ws.close();
  edge.kill();
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
