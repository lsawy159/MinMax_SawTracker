import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'https://staging.sawtracker.com';
const DURATION = __ENV.DURATION || '5m';
const VUS = __ENV.VUS || 100;

export let options = {
  stages: [
    { duration: '1m', target: VUS / 2 },     // Ramp up to 50 users
    { duration: '2m', target: VUS },         // Ramp up to 100 users
    { duration: `${DURATION}`, target: VUS }, // Stay at 100 users
    { duration: '1m', target: 0 },           // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500', 'p(99)<1000'], // 95% response time < 500ms, 99% < 1s
    http_req_failed: ['rate<0.01'], // Error rate < 1%
  },
};

export default function () {
  // Test 1: Get dashboard stats
  let dashboardRes = http.get(`${BASE_URL}/api/dashboard-stats`, {
    headers: {
      'Authorization': `Bearer ${__ENV.JWT_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
  });

  check(dashboardRes, {
    'dashboard status is 200': (r) => r.status === 200,
    'dashboard response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 2: Get employees list
  let employeesRes = http.get(`${BASE_URL}/api/employees?page=0&size=50`, {
    headers: {
      'Authorization': `Bearer ${__ENV.JWT_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
  });

  check(employeesRes, {
    'employees status is 200': (r) => r.status === 200,
    'employees response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 3: Get companies list
  let companiesRes = http.get(`${BASE_URL}/api/companies?page=0&size=50`, {
    headers: {
      'Authorization': `Bearer ${__ENV.JWT_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
  });

  check(companiesRes, {
    'companies status is 200': (r) => r.status === 200,
    'companies response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test 4: Get alerts
  let alertsRes = http.get(`${BASE_URL}/api/alerts`, {
    headers: {
      'Authorization': `Bearer ${__ENV.JWT_TOKEN || ''}`,
      'Content-Type': 'application/json',
    },
  });

  check(alertsRes, {
    'alerts status is 200': (r) => r.status === 200,
    'alerts response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(2);
}
