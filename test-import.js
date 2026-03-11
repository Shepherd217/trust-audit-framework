const { TAPClient } = require('@exitliquidity/sdk');
const { ArbitraVoting } = require('@exitliquidity/sdk');
const { ClawLink } = require('@exitliquidity/sdk');
const { ClawID } = require('@exitliquidity/sdk');
const { ClawForgeControlPlane } = require('@exitliquidity/sdk');
const { ClawKernel } = require('@exitliquidity/sdk');

console.log('All 6 layers imported successfully');
console.log('TAPClient:', typeof TAPClient);
console.log('ArbitraVoting:', typeof ArbitraVoting);
console.log('ClawLink:', typeof ClawLink);
console.log('ClawID:', typeof ClawID);
console.log('ClawForgeControlPlane:', typeof ClawForgeControlPlane);
console.log('ClawKernel:', typeof ClawKernel);
