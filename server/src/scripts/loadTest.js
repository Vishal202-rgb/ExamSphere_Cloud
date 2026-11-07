// ==============================================================================
// ExamSphere – High-Concurrency Load Testing Benchmark (100 Concurrent Students)
// Measures real throughput, latency percentiles, and error rates under load
// ==============================================================================

import http from 'http';
import app from '../app.js';

const TOTAL_REQUESTS = 1000;
const CONCURRENCY = 100;

function calculatePercentile(sortedArray, percentile) {
  if (sortedArray.length === 0) return 0;
  const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
  return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
}

async function runLoadTest() {
  console.log(`\n==============================================================`);
  console.log(`🚀 ExamSphere High-Concurrency Load Test Benchmark`);
  console.log(`--------------------------------------------------------------`);
  console.log(`🎯 Target Concurrency : ${CONCURRENCY} simultaneous virtual students`);
  console.log(`📊 Total Requests     : ${TOTAL_REQUESTS} requests`);
  console.log(`⚡ Scenario           : Health, Liveness Probes & API Gateway routing`);
  console.log(`==============================================================\n`);

  // Start server on an ephemeral free port
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  console.log(`📡 Benchmark test server running on port ${port}...\n`);

  const agent = new http.Agent({
    keepAlive: true,
    maxSockets: CONCURRENCY,
  });

  const latencies = [];
  const statusCodes = {};
  let completed = 0;
  let errors = 0;

  const endpoints = ['/health', '/api/v1'];

  const startTime = Date.now();

  async function sendWorkerRequests(count) {
    for (let i = 0; i < count; i++) {
      const endpoint = endpoints[i % endpoints.length];
      const reqStart = process.hrtime.bigint();

      await new Promise((resolveReq) => {
        const req = http.get(
          {
            hostname: '127.0.0.1',
            port,
            path: endpoint,
            agent,
            headers: {
              'User-Agent': 'ExamSphere-LoadTester/1.0',
              'X-Request-Id': `load-test-${i}-${Date.now()}`,
            },
          },
          (res) => {
            let data = '';
            res.on('data', (chunk) => {
              data += chunk;
            });
            res.on('end', () => {
              const reqEnd = process.hrtime.bigint();
              const durationMs = Number(reqEnd - reqStart) / 1_000_000;
              latencies.push(durationMs);

              statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
              completed++;
              resolveReq();
            });
          }
        );

        req.on('error', (err) => {
          errors++;
          completed++;
          resolveReq();
        });

        req.setTimeout(5000, () => {
          req.destroy();
          errors++;
          completed++;
          resolveReq();
        });
      });
    }
  }

  // Distribute requests across concurrent workers
  const requestsPerWorker = Math.floor(TOTAL_REQUESTS / CONCURRENCY);
  const workers = [];

  for (let w = 0; w < CONCURRENCY; w++) {
    workers.push(sendWorkerRequests(requestsPerWorker));
  }

  await Promise.all(workers);

  const totalTimeMs = Date.now() - startTime;
  const totalSeconds = totalTimeMs / 1000;
  const rps = (completed / totalSeconds).toFixed(2);

  latencies.sort((a, b) => a - b);
  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const mean = (sum / (latencies.length || 1)).toFixed(2);
  const min = latencies.length > 0 ? latencies[0].toFixed(2) : '0';
  const max = latencies.length > 0 ? latencies[latencies.length - 1].toFixed(2) : '0';
  const p50 = calculatePercentile(latencies, 50).toFixed(2);
  const p90 = calculatePercentile(latencies, 90).toFixed(2);
  const p95 = calculatePercentile(latencies, 95).toFixed(2);
  const p99 = calculatePercentile(latencies, 99).toFixed(2);

  // Close test server
  await new Promise((resolve) => server.close(resolve));

  console.log(`==============================================================`);
  console.log(`📈 LOAD TEST BENCHMARK RESULTS`);
  console.log(`==============================================================`);
  console.log(`⏱️ Duration           : ${(totalSeconds).toFixed(2)} seconds`);
  console.log(`📨 Total Completed    : ${completed} / ${TOTAL_REQUESTS}`);
  console.log(`🚀 Throughput (RPS)   : ${rps} requests/sec`);
  console.log(`⚠️ Errors             : ${errors} (${((errors / completed) * 100).toFixed(2)}%)`);
  console.log(`--------------------------------------------------------------`);
  console.log(`📊 HTTP Status Codes  :`);
  for (const [code, count] of Object.entries(statusCodes)) {
    console.log(`   - HTTP ${code}: ${count} requests`);
  }
  console.log(`--------------------------------------------------------------`);
  console.log(`⚡ Latency Distribution:`);
  console.log(`   - Min Latency       : ${min} ms`);
  console.log(`   - Mean Latency      : ${mean} ms`);
  console.log(`   - Median (p50)      : ${p50} ms`);
  console.log(`   - 90th Percentile   : ${p90} ms`);
  console.log(`   - 95th Percentile   : ${p95} ms`);
  console.log(`   - 99th Percentile   : ${p99} ms`);
  console.log(`   - Max Latency       : ${max} ms`);
  console.log(`==============================================================\n`);

  return {
    concurrency: CONCURRENCY,
    totalRequests: completed,
    durationSeconds: totalSeconds,
    requestsPerSecond: Number(rps),
    errors,
    statusCodes,
    latencies: { min: Number(min), mean: Number(mean), p50: Number(p50), p90: Number(p90), p95: Number(p95), p99: Number(p99), max: Number(max) },
  };
}

if (process.argv[1]?.endsWith('loadTest.js')) {
  runLoadTest()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Benchmark failed:', err);
      process.exit(1);
    });
}

export { runLoadTest };
