#!/bin/bash
# Test suite for trust-audit-cli.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLI="$SCRIPT_DIR/../trust-audit-cli.sh"
TEST_DIR="/tmp/trust-audit-test-$$"

echo "=== Trust Audit CLI Test Suite ==="
echo ""

# Setup
setup() {
    mkdir -p "$TEST_DIR"
    cd "$TEST_DIR"
    # Create required files
    touch AGENTS.md SOUL.md USER.md TOOLS.md MEMORY.md HEARTBEAT.md
    echo "Test content" > AGENTS.md
}

# Cleanup
cleanup() {
    rm -rf "$TEST_DIR"
}

# Test 1: Help command
test_help() {
    echo "Test 1: Help command"
    if $CLI help > /dev/null 2>&1; then
        echo "  ✅ Help command works"
    else
        echo "  ❌ Help command failed"
        return 1
    fi
}

# Test 2: Boot audit with full compliance
test_boot_audit_full() {
    echo "Test 2: Boot audit (FULL compliance)"
    cd "$TEST_DIR"
    AGENT_ID="test-full" WORKSPACE="$TEST_DIR" $CLI boot-audit > /dev/null 2>&1
    
    if [ -f "boot-audit-test-full.json" ]; then
        if jq . "boot-audit-test-full.json" > /dev/null 2>&1; then
            echo "  ✅ Boot audit creates valid JSON"
            
            COMPLIANCE=$(jq -r '.compliance_status' "boot-audit-test-full.json")
            SCORE=$(jq -r '.compliance_score' "boot-audit-test-full.json")
            
            if [ "$COMPLIANCE" = "FULL" ] && [ "$SCORE" = "100" ]; then
                echo "  ✅ Compliance: $COMPLIANCE ($SCORE%)"
            else
                echo "  ❌ Expected FULL/100, got $COMPLIANCE/$SCORE"
                return 1
            fi
        else
            echo "  ❌ Invalid JSON output"
            return 1
        fi
    else
        echo "  ❌ Boot audit file not created"
        return 1
    fi
}

# Test 3: Boot audit with partial compliance
test_boot_audit_partial() {
    echo "Test 3: Boot audit (PARTIAL compliance)"
    mkdir -p "$TEST_DIR-partial"
    cd "$TEST_DIR-partial"
    # Create only 3 files (missing 3)
    touch AGENTS.md SOUL.md USER.md
    
    AGENT_ID="test-partial" WORKSPACE="$TEST_DIR-partial" $CLI boot-audit > /dev/null 2>&1 || true
    
    if [ -f "boot-audit-test-partial.json" ]; then
        COMPLIANCE=$(jq -r '.compliance_status' "boot-audit-test-partial.json")
        SCORE=$(jq -r '.compliance_score' "boot-audit-test-partial.json")
        
        if [ "$COMPLIANCE" = "PARTIAL" ] && [ "$SCORE" -lt 100 ]; then
            echo "  ✅ Compliance: $COMPLIANCE ($SCORE%)"
        else
            echo "  ❌ Expected PARTIAL/<100, got $COMPLIANCE/$SCORE"
            return 1
        fi
    else
        echo "  ❌ Boot audit file not created"
        return 1
    fi
    
    rm -rf "$TEST_DIR-partial"
}

# Test 4: Boot audit with no files (0% score, not negative)
test_boot_audit_empty() {
    echo "Test 4: Boot audit (no files - should be 0%, not negative)"
    mkdir -p "$TEST_DIR-empty"
    cd "$TEST_DIR-empty"
    
    AGENT_ID="test-empty" WORKSPACE="$TEST_DIR-empty" $CLI boot-audit > /dev/null 2>&1 || true
    
    if [ -f "boot-audit-test-empty.json" ]; then
        SCORE=$(jq -r '.compliance_score' "boot-audit-test-empty.json")
        
        if [ "$SCORE" -ge 0 ]; then
            echo "  ✅ Score is $SCORE% (non-negative)"
        else
            echo "  ❌ Score is negative: $SCORE%"
            return 1
        fi
    else
        echo "  ❌ Boot audit file not created"
        return 1
    fi
    
    rm -rf "$TEST_DIR-empty"
}

# Test 5: Ledger creation
test_ledger_create() {
    echo "Test 5: Trust Ledger creation"
    cd "$TEST_DIR"
    AGENT_ID="test-ledger" $CLI ledger-create > /dev/null 2>&1
    
    if [ -f "trust-ledger-test-ledger.json" ]; then
        if jq . "trust-ledger-test-ledger.json" > /dev/null 2>&1; then
            echo "  ✅ Trust Ledger creates valid JSON"
        else
            echo "  ❌ Invalid JSON output"
            return 1
        fi
    else
        echo "  ❌ Trust Ledger file not created"
        return 1
    fi
}

# Test 6: Validate command (with both files)
test_validate() {
    echo "Test 6: Validate command"
    cd "$TEST_DIR"
    # Create both files first
    AGENT_ID="test-validate" WORKSPACE="$TEST_DIR" $CLI boot-audit > /dev/null 2>&1
    AGENT_ID="test-validate" $CLI ledger-create > /dev/null 2>&1
    
    if AGENT_ID="test-validate" $CLI validate > /dev/null 2>&1; then
        echo "  ✅ Validation passes with both files"
    else
        echo "  ❌ Validation failed"
        return 1
    fi
}

# Test 7: Status command
test_status() {
    echo "Test 7: Status command"
    cd "$TEST_DIR"
    if AGENT_ID="test-validate" $CLI status > /dev/null 2>&1; then
        echo "  ✅ Status command works"
    else
        echo "  ❌ Status command failed"
        return 1
    fi
}

# Test 8: Attest command
test_attest() {
    echo "Test 8: Attest command"
    cd "$TEST_DIR"
    AGENT_ID="test-attestor" $CLI attest --attestee agent-alpha --claim claim-001 --result CONFIRMED > /dev/null 2>&1
    
    if [ -f "attestation-test-attestor-to-agent-alpha.json" ]; then
        if jq . "attestation-test-attestor-to-agent-alpha.json" > /dev/null 2>&1; then
            echo "  ✅ Attestation creates valid JSON"
        else
            echo "  ❌ Invalid JSON output"
            return 1
        fi
    else
        echo "  ❌ Attestation file not created"
        return 1
    fi
}

# Run all tests
main() {
    setup
    
    local failed=0
    
    test_help || failed=1
    test_boot_audit_full || failed=1
    test_boot_audit_partial || failed=1
    test_boot_audit_empty || failed=1
    test_ledger_create || failed=1
    test_validate || failed=1
    test_status || failed=1
    test_attest || failed=1
    
    cleanup
    
    echo ""
    if [ $failed -eq 0 ]; then
        echo "=== ✅ All tests passed ==="
        exit 0
    else
        echo "=== ❌ Some tests failed ==="
        exit 1
    fi
}

main "$@"
