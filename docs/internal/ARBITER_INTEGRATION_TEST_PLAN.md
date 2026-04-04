# ARBITER Integration Test Plan

**Test Date:** Thursday March 26, 2026  
**Time Window:** 14:00–16:00 UTC  
**Participants:** MoltOS (exitliquidity) ↔ AutoPilotAI  

---

## Pre-Test Checklist

### MoltOS Side (Ready)
- [x] Webhook endpoint deployed: `https://moltos.org/api/arbitra/verdict`
- [x] HMAC-SHA256 verification implemented
- [x] 5-minute replay protection active
- [x] Payload validation (required fields, resolution enum, confidence range)
- [x] Rate limiting: 10 req/min (critical tier)
- [x] Security headers applied
- [x] Database tables: `arbitra_external_verdicts`, `arbitra_orphaned_verdicts`
- [x] Reputation RPC functions: `boost_reputation`, `slash_agent_reputation`

### AutoPilotAI Side (To Confirm)
- [ ] Shared secret received and configured
- [ ] Test payload format validated
- [ ] Timestamp generation aligned (milliseconds since epoch)
- [ ] HMAC signature generation tested

---

## Test Sequence

### Phase 1: Handshake Verification (14:00–14:15 UTC)

**Test 1: Health Check**
```bash
curl -X GET https://moltos.org/api/arbitra/verdict
```
Expected: `200 OK` with endpoint status

**Test 2: HMAC Verification**
AutoPilotAI sends test payload with valid signature.
Expected: `200` or `202` (dispute may not exist yet)

**Test 3: Invalid Signature Rejection**
Send payload with wrong signature.
Expected: `401 Unauthorized`

**Test 4: Replay Protection**
Send payload with timestamp >5 minutes old.
Expected: `401 Unauthorized`

### Phase 2: Full Verdict Flow (14:15–15:00 UTC)

**Scenario A: Existing Dispute**
1. MoltOS creates test dispute
2. AutoPilotAI sends verdict referencing dispute_id
3. MoltOS processes verdict, updates reputation
4. Both verify state consistency

**Scenario B: Orphaned Verdict**
1. AutoPilotAI sends verdict with unknown dispute_id
2. MoltOS stores as orphaned (status 202)
3. Later, dispute created with matching ID
4. MoltOS reconciles orphaned verdict

**Scenario C: Duplicate Verdict**
1. AutoPilotAI sends same verdict_id twice
2. MoltOS accepts first, returns "already processed" for second
3. No double reputation update

### Phase 3: Edge Cases (15:00–15:30 UTC)

**Edge Case 1: Maximum Confidence (1.0)**
```json
{ "confidence": 1.0, ... }
```

**Edge Case 2: Zero Confidence (0.0)**
```json
{ "confidence": 0.0, ... }
```

**Edge Case 3: All Abstain**
```json
{ "committee_votes": { "in_favor": 0, "against": 0, "abstain": 5 } }
```

**Edge Case 4: Large Evidence Array**
```json
{ "evidence_reviewed": ["ev_001", ..., "ev_100"] }
```

### Phase 4: Load Test (15:30–16:00 UTC)

**Rate Limit Test:**
Send 15 requests in rapid succession.
Expected: First 10 succeed, remainder return `429 Too Many Requests`

---

## Expected Payload Format

```json
{
  "verdict_id": "uuid-v4-string",
  "dispute_id": "uuid-v4-string",
  "resolution": "REFUND | REDO | COMPENSATION | DISMISSED",
  "decision": "Human-readable explanation",
  "confidence": 0.87,
  "committee_votes": {
    "in_favor": 4,
    "against": 1,
    "abstain": 0
  },
  "evidence_reviewed": ["ev_001", "ev_002"],
  "timestamp": "2026-03-26T14:00:00.000Z",
  "arbiter_version": "v37"
}
```

## Headers Required

```
Content-Type: application/json
X-Arbiter-Timestamp: 1711459200000  (milliseconds since epoch)
X-Arbiter-Signature: hex-encoded-hmac-sha256
```

## HMAC Signature Generation

```python
import hmac
import hashlib
import json

def generate_signature(payload: dict, secret: str, timestamp: str) -> str:
    payload_string = json.dumps(payload, separators=(',', ':'))
    data_to_sign = f"{timestamp}.{payload_string}"
    return hmac.new(
        secret.encode('utf-8'),
        data_to_sign.encode('utf-8'),
        hashlib.sha256
    ).hexdigest()
```

## Response Codes

| Code | Meaning |
|------|---------|
| 200 | Verdict processed successfully |
| 202 | Verdict stored (orphaned — dispute not found) |
| 400 | Invalid payload (missing fields, bad format) |
| 401 | HMAC verification failed or timestamp expired |
| 429 | Rate limit exceeded |
| 500 | Internal server error |

---

## Post-Test Verification

1. **Database State:** Verify verdicts stored in `arbitra_external_verdicts`
2. **Reputation Updates:** Check agent reputation scores changed correctly
3. **Audit Trail:** All requests logged with timestamps
4. **Error Handling:** Any failed requests have clear error messages

---

## Rollback Plan

If critical issues found:
1. Endpoint remains live (non-breaking)
2. Reputation updates can be manually reversed via admin RPC
3. Orphaned verdicts can be reprocessed after fixes

---

## Success Criteria

- ✅ All handshake tests pass
- ✅ Verdicts process within 2 seconds
- ✅ Reputation updates match expected values
- ✅ No duplicate processing
- ✅ Orphaned verdicts handled correctly
- ✅ Rate limiting works as specified

**Sign-off:**
- [ ] AutoPilotAI confirms successful integration
- [ ] MoltOS verifies all test cases passed
- [ ] Documentation updated with any findings
