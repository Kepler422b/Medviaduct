// scripts/test-e2e.mjs
/**
 * End-to-End Automated Integration Test Suite for Medviaduct
 *
 * Verifies all 8 required QR + RBAC + AI scenarios via direct HTTP calls:
 * 1. Valid QR presentation + assigned clinician -> 200 OK
 * 2. Valid QR presentation + unassigned clinician -> 403 Forbidden (UNASSIGNED_CLINICIAN_DENIED)
 * 3. Expired or revoked QR presentation -> 403 Forbidden (EXPIRED_TOKEN)
 * 4. Direct patient ID request by another patient (IDOR attack) -> 403 Forbidden (IDOR_VIOLATION_DENIED)
 * 5. Administrator attempting clinical record access -> 403 Forbidden (ADMIN_CLINICAL_ACCESS_PROHIBITED)
 * 6. Authorized clinician requesting MediMate AI summary -> 200 OK structured summary with provenance
 * 7. Unauthorized user requesting MediMate AI summary -> 403 Forbidden (rejected pre-model)
 * 8. Aggregate public-health query -> 200 OK aggregate dashboard with k >= 10 suppression
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:5173';

const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  bold: '\x1b[1m'
};

async function run() {
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  MEDVIADUCT END-TO-END QR, RBAC & AI INTEGRATION TEST SUITE   ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}  Testing target: ${BASE_URL}                                  ${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}================================================================${colors.reset}\n`);

  let totalTests = 0;
  let passedTests = 0;

  async function testCase(num, title, fn) {
    totalTests++;
    process.stdout.write(`[Test ${num}] ${title} ... `);
    try {
      const res = await fn();
      if (res.pass) {
        passedTests++;
        console.log(`${colors.green}✓ PASSED${colors.reset} (${res.detail})`);
      } else {
        console.log(`${colors.red}✗ FAILED${colors.reset}: ${res.error}`);
      }
    } catch (err) {
      console.log(`${colors.red}✗ ERROR${colors.reset}: ${err.message}`);
    }
  }

  // -------------------------------------------------------------
  // Test 1: Valid QR presentation + assigned clinician -> 200 OK
  // -------------------------------------------------------------
  await testCase(1, 'Valid QR + assigned clinician', async () => {
    // Generate token
    const genRes = await fetch(`${BASE_URL}/api/qr/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-account': 'patient-a'
      },
      body: JSON.stringify({ patientId: 'PAT-MH-40192', durationMinutes: 15 })
    });
    const genData = await genRes.json();
    if (!genData.success) return { pass: false, error: 'Token generation failed' };

    // Resolve with assigned clinician
    const resRes = await fetch(`${BASE_URL}/api/qr/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-account': 'clinician-assigned'
      },
      body: JSON.stringify({ token: genData.data.token })
    });
    const resData = await resRes.json();
    return {
      pass: resRes.status === 200 && resData.success === true,
      detail: `Status ${resRes.status}, Grant ID: ${resData.data?.accessGrant?.accessGrantId?.slice(0, 8)}...`
    };
  });

  // -------------------------------------------------------------
  // Test 2: Valid QR presentation + unassigned clinician -> 403 Forbidden
  // -------------------------------------------------------------
  await testCase(2, 'Valid QR + unassigned clinician -> 403', async () => {
    // Generate valid token
    const genRes = await fetch(`${BASE_URL}/api/qr/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-account': 'patient-a'
      },
      body: JSON.stringify({ patientId: 'PAT-MH-40192', durationMinutes: 15 })
    });
    const genData = await genRes.json();

    // Resolve with UNASSIGNED clinician
    const resRes = await fetch(`${BASE_URL}/api/qr/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-account': 'clinician-unassigned'
      },
      body: JSON.stringify({ token: genData.data.token })
    });
    const resData = await resRes.json();
    return {
      pass: resRes.status === 403 && resData.code === 'UNASSIGNED_CLINICIAN_DENIED',
      detail: `Status ${resRes.status}, Code: ${resData.code}`
    };
  });

  // -------------------------------------------------------------
  // Test 3: Expired QR token -> 403 Forbidden
  // -------------------------------------------------------------
  await testCase(3, 'Expired QR token -> 403 Forbidden', async () => {
    const res = await fetch(`${BASE_URL}/api/qr/resolve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-demo-account': 'clinician-assigned'
      },
      body: JSON.stringify({ token: 'MV-EXPIRED-TEST-TOKEN-999' })
    });
    const data = await res.json();
    return {
      pass: res.status === 403 && data.code === 'EXPIRED_TOKEN',
      detail: `Status ${res.status}, Code: ${data.code}`
    };
  });

  // -------------------------------------------------------------
  // Test 4: Patient B requesting Patient A record (IDOR) -> 403 Forbidden
  // -------------------------------------------------------------
  await testCase(4, 'IDOR Prevention (Patient B -> Patient A) -> 403', async () => {
    const res = await fetch(`${BASE_URL}/api/patients/PAT-MH-40192/records`, {
      method: 'GET',
      headers: {
        'x-demo-account': 'patient-b'
      }
    });
    const data = await res.json();
    return {
      pass: res.status === 403 && data.reasonCode === 'IDOR_VIOLATION_DENIED',
      detail: `Status ${res.status}, Reason: ${data.reasonCode}`
    };
  });

  // -------------------------------------------------------------
  // Test 5: Administrator attempting clinical record access -> 403 Forbidden
  // -------------------------------------------------------------
  await testCase(5, 'Administrator clinical isolation -> 403', async () => {
    const res = await fetch(`${BASE_URL}/api/patients/PAT-MH-40192/records`, {
      method: 'GET',
      headers: {
        'x-demo-account': 'administrator'
      }
    });
    const data = await res.json();
    return {
      pass: res.status === 403 && data.reasonCode === 'ADMIN_CLINICAL_ACCESS_PROHIBITED',
      detail: `Status ${res.status}, Reason: ${data.reasonCode}`
    };
  });

  // -------------------------------------------------------------
  // Test 6: Authorized clinician MediMate AI summary -> 200 OK
  // -------------------------------------------------------------
  await testCase(6, 'Authorized clinician MediMate AI summary -> 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/patients/PAT-MH-40192/clinical-summary`, {
      method: 'POST',
      headers: {
        'x-demo-account': 'clinician-assigned'
      }
    });
    const data = await res.json();
    const hasFacts = data.data?.verifiedClinicalFacts?.length > 0;
    const hasNotice = typeof data.data?.clinicianReviewNotice === 'string';
    return {
      pass: res.status === 200 && data.success && hasFacts && hasNotice,
      detail: `Status ${res.status}, Facts: ${data.data?.verifiedClinicalFacts?.length}, Observations: ${data.data?.aiClinicalObservations?.length}`
    };
  });

  // -------------------------------------------------------------
  // Test 7: Unauthorized user MediMate AI summary -> 403 Forbidden
  // -------------------------------------------------------------
  await testCase(7, 'Unauthorized user MediMate AI summary -> 403 (Pre-Model)', async () => {
    const res = await fetch(`${BASE_URL}/api/patients/PAT-MH-40192/clinical-summary`, {
      method: 'POST',
      headers: {
        'x-demo-account': 'clinician-unassigned'
      }
    });
    const data = await res.json();
    return {
      pass: res.status === 403 && data.reasonCode === 'UNAUTHORIZED_AI_REQUEST',
      detail: `Status ${res.status}, Blocked at Pre-Model RBAC Gate`
    };
  });

  // -------------------------------------------------------------
  // Test 8: Aggregate public-health surveillance (k >= 10) -> 200 OK
  // -------------------------------------------------------------
  await testCase(8, 'Aggregate public-health surveillance (k >= 10) -> 200 OK', async () => {
    const res = await fetch(`${BASE_URL}/api/analytics/public-health?disease=Dengue`);
    const data = await res.json();
    const report = data.report;
    const validGov = report?.governance?.individualMicrodataExposed === false;
    const validK = report?.kanonymityThreshold === 10;
    const hasForecast = report?.aiEpidemiologicalForecast?.forecastWeeks?.length > 0;
    return {
      pass: res.status === 200 && validGov && validK && hasForecast,
      detail: `Status ${res.status}, Divisions: ${report?.divisionAggregates?.length}, k: ${report?.kanonymityThreshold}, Forecast intervals: ${hasForecast}`
    };
  });

  // -------------------------------------------------------------
  // Test 9: Complete /api/demo/scenarios runner integration
  // -------------------------------------------------------------
  await testCase(9, 'Comprehensive scenario runner endpoint verification', async () => {
    const res = await fetch(`${BASE_URL}/api/demo/scenarios`);
    const data = await res.json();
    return {
      pass: res.status === 200 && data.summary?.allPassed === true,
      detail: `${data.summary?.passedCount}/${data.summary?.totalScenarios} scenarios passing live`
    };
  });

  console.log(`\n${colors.cyan}${colors.bold}----------------------------------------------------------------${colors.reset}`);
  console.log(`${colors.bold}Test Summary: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests / totalTests) * 100)}%)${colors.reset}`);
  console.log(`${colors.cyan}${colors.bold}----------------------------------------------------------------${colors.reset}\n`);

  if (passedTests === totalTests) {
    console.log(`${colors.green}${colors.bold}ALL VERIFICATION SCENARIOS PASSED SUCCESSFULLY.${colors.reset}\n`);
    process.exit(0);
  } else {
    console.log(`${colors.red}${colors.bold}SOME TESTS FAILED.${colors.reset}\n`);
    process.exit(1);
  }
}

run();
