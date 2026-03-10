const fs = require('fs');
const path = require('path');

console.log('Running TAP Preflight Check...\n');

let score = 0;
let total = 5;

// Check 1: README exists and has safe install
const readme = fs.readFileSync(path.join(__dirname, 'README.md'), 'utf8');
if (readme.includes('Scan everything first') && !readme.includes('curl -sSL') && readme.includes('git clone')) {
  console.log('✅ README: Safe install instructions present');
  score++;
} else {
  console.log('❌ README: Missing safe install instructions');
}

// Check 2: CLAWHUB.md updated
const clawhub = fs.readFileSync(path.join(__dirname, 'CLAWHUB.md'), 'utf8');
if (clawhub.includes('No Blind Execution') && !clawhub.includes('Cohort #1')) {
  console.log('✅ CLAWHUB.md: Claude feedback integrated');
  score++;
} else {
  console.log('❌ CLAWHUB.md: Needs updates');
}

// Check 3: Website page updated
const pagePath = path.join(__dirname, 'tap-dashboard/app/page.tsx');
if (fs.existsSync(pagePath)) {
  const page = fs.readFileSync(pagePath, 'utf8');
  if (page.includes('Scan Everything First') && !page.includes('curl -sSL')) {
    console.log('✅ Website: Safe install hero message');
    score++;
  } else {
    console.log('❌ Website: Needs safe install update');
  }
} else {
  console.log('⚠️ Website: page.tsx not found');
}

// Check 4: SKILL.md exists with master context
if (fs.existsSync(path.join(__dirname, 'SKILL.md'))) {
  console.log('✅ SKILL.md: Master context locked');
  score++;
} else {
  console.log('❌ SKILL.md: Missing');
}

// Check 5: No crypto/FOMO language
const hasFOMO = readme.includes('miss it') || readme.includes('slots left') || readme.includes('first 20');
const hasCrypto = readme.includes('$ALPHA') || readme.includes('staking') || readme.includes('6,000 α');
if (!hasFOMO && !hasCrypto) {
  console.log('✅ Content: No FOMO/crypto language');
  score++;
} else {
  console.log('❌ Content: Still has FOMO/crypto language');
}

console.log(`\n📊 Preflight Score: ${score}/${total} (${Math.round(score/total*100)}%)`);

if (score === total) {
  console.log('\n✅ ALL CHECKS PASSED — READY FOR DEPLOY');
  process.exit(0);
} else {
  console.log('\n⚠️ SOME CHECKS FAILED — REVIEW OUTPUT');
  process.exit(1);
}
