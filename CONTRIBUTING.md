# Contributing to Trust Audit Framework

Thank you for your interest in contributing! This document provides guidelines for contributing to the framework.

## Table of Contents

- [Getting Started](#getting-started)
- [Types of Contributions](#types-of-contributions)
- [Development Setup](#development-setup)
- [Submitting Changes](#submitting-changes)
- [Code Standards](#code-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Community](#community)

---

## Getting Started

### Prerequisites

- Python 3.8+ or Node.js 16+ (depending on implementation)
- Git
- A workspace to test boot audits on

### Quick Setup

```bash
git clone https://github.com/exitliquidity/trust-audit-framework.git
cd trust-audit-framework
./demo.sh  # See the framework in action
```

---

## Types of Contributions

We welcome these types of contributions:

### 1. **New Agent Implementations** 🎯

Add support for new languages/platforms:

- **Layer 1 (Boot Audit):** Minimum viable — check workspace integrity
- **Layer 2 (Trust Ledger):** Add behavioral transparency
- **Layer 3+4:** Full cross-attestation and staking

**Example structure:**
```
reference-implementations/
├── agent-e-rust/         # Your contribution
│   ├── Cargo.toml
│   ├── src/main.rs
│   └── README.md
```

**Requirements:**
- Must output valid boot-audit JSON (see attestation-format-spec.md)
- Must include README with usage instructions
- Must pass edge case tests

### 2. **Bug Fixes** 🐛

Found an issue? We need:
- Clear description of the bug
- Steps to reproduce
- Expected vs actual behavior
- Fix with test case

### 3. **Documentation** 📚

Help others understand the framework:
- Tutorial articles
- API documentation
- Architecture explanations
- Translation to other languages

### 4. **Testing** 🧪

Improve test coverage:
- Edge case scenarios
- Performance benchmarks
- Security audits
- Integration tests

### 5. **Integrations** 🔌

Connect to existing agent platforms:
- AutoGPT plugin
- LangChain integration
- CrewAI adapter
- Custom agent frameworks

---

## Development Setup

### Fork and Clone

```bash
# Fork the repo on GitHub, then:
git clone https://github.com/YOUR_USERNAME/trust-audit-framework.git
cd trust-audit-framework
git remote add upstream https://github.com/exitliquidity/trust-audit-framework.git
```

### Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### Branch Naming

- `feature/` — New features or enhancements
- `fix/` — Bug fixes
- `docs/` — Documentation changes
- `test/` — Test additions or improvements
- `refactor/` — Code refactoring

---

## Submitting Changes

### Before Submitting

1. **Test your changes:**
   ```bash
   # Run existing tests
   python3 test-edge-cases.py
   
   # Run your new tests
   python3 test-your-feature.py
   
   # Test the demo still works
   ./demo.sh
   ```

2. **Check code style:**
   - Python: Follow PEP 8
   - JavaScript: Use 2-space indentation
   - Shell: Use 2-space indentation
   - Keep lines under 100 characters

3. **Update documentation:**
   - README.md if adding features
   - ARCHITECTURE.md if changing structure
   - Inline comments for complex logic

### Commit Messages

Use clear, descriptive commit messages:

```
Add Rust agent implementation (Agent E)

- Layer 1: Boot audit with cargo-based verification
- Layer 2: Trust Ledger with serde serialization
- Passes all 6 edge case tests
- Includes README and usage examples
```

Format:
```
<subject> (imperative mood, max 50 chars)

<body> (explain what and why, not how, wrap at 72 chars)

<footer> (optional: fixes #123, relates to #456)
```

### Pull Request Process

1. **Push your branch:**
   ```bash
   git push origin feature/your-feature-name
   ```

2. **Open a Pull Request on GitHub:**
   - Use a clear title
   - Describe what changed and why
   - Reference any related issues
   - Include test results

3. **PR Checklist:**
   - [ ] Tests pass locally
   - [ ] Documentation updated
   - [ ] No breaking changes (or clearly documented)
   - [ ] Follows code style guidelines
   - [ ] Includes test cases for new features

4. **Review Process:**
   - Maintainers will review within 48 hours
   - Address feedback with additional commits
   - Squash commits if requested

---

## Code Standards

### Python

```python
# Use type hints
def calculate_compliance(files_present: int, total: int) -> float:
    """Calculate compliance score as percentage."""
    return (files_present / total) * 100

# Document functions
def create_ledger_entry(
    action: str,
    human_requested: bool,
    suppressed: Optional[str] = None
) -> Dict[str, Any]:
    """
    Create a new Trust Ledger entry.
    
    Args:
        action: Description of the action taken
        human_requested: Whether the action was explicitly requested
        suppressed: Any information that was suppressed
    
    Returns:
        Ledger entry dictionary with classification
    """
    # Implementation here
    pass

# Constants in UPPER_CASE
CORE_FILES = ['AGENTS.md', 'SOUL.md', 'USER.md', 'TOOLS.md', 'MEMORY.md', 'HEARTBEAT.md']

# Classes use CapWords
class TrustLedger:
    def __init__(self, agent_id: str, workspace: Path):
        self.agent_id = agent_id
        self.workspace = workspace
```

### JavaScript/Node.js

```javascript
// Use const/let, not var
const fs = require('fs').promises;

// Async/await preferred
async function runAudit(agentId, workspace) {
  const files = await checkCoreFiles(workspace);
  return {
    agent_id: agentId,
    compliance: calculateCompliance(files)
  };
}

// JSDoc comments
/**
 * Create a Trust Ledger entry
 * @param {string} action - Description of action taken
 * @param {boolean} humanRequested - Whether human explicitly requested
 * @param {string} [suppressed] - Any suppressed information
 * @returns {Object} Ledger entry
 */
function createEntry(action, humanRequested, suppressed = null) {
  // Implementation
}
```

### Shell Scripts

```bash
#!/bin/bash

# Use descriptive variable names
WORKSPACE_DIR="${1:-/root/.openclaw/workspace}"
AGENT_ID="${2:-$(hostname)}"

# Quote variables
if [ -f "$WORKSPACE_DIR/$file" ]; then
    echo "Found: $file"
fi

# Functions for reusable code
check_file() {
    local file="$1"
    if [ -f "$file" ]; then
        echo "present"
    else
        echo "missing"
    fi
}
```

---

## Testing

### Running Tests

```bash
# All edge case tests
python3 test-edge-cases.py

# Cross-attestation simulation
python3 test-cross-attestation-enhanced.py

# Specific agent test
./reference-implementations/agent-a-boot-audit.sh test-agent /tmp/test-workspace

# With verbose output
python3 test-edge-cases.py --verbose
```

### Writing Tests

For new agent implementations:

```python
def test_your_agent():
    """Test your new agent implementation."""
    workspace = create_test_workspace()
    
    # Test basic functionality
    result = run_your_agent("test", workspace)
    assert result['compliance']['score'] == 100
    
    # Test edge cases
    test_missing_files(workspace)
    test_override_detection(workspace)
    
    print("✓ All tests passed")
```

### Test Coverage Requirements

- **Minimum:** 80% code coverage
- **Required:** All 6 edge cases must pass
- **Required:** Must work with demo.sh
- **Required:** Must output valid JSON schema

---

## Documentation

### README Template for New Implementations

```markdown
# Agent X — [Language] Implementation

Brief description of what this agent does.

## Features

- Layer 1: Boot-time audit
- Layer 2: Trust Ledger (if applicable)
- etc.

## Installation

```bash
# Installation steps
```

## Usage

```bash
# Basic usage
./agent-x [agent-id] [workspace-path]

# With options
./agent-x --verbose --output custom.json
```

## Output Format

Describe the JSON output format.

## Testing

```bash
# How to test this agent
```

## License

MIT
```

### Code Comments

Comment the "why", not the "what":

```python
# Good: Explains why
# Hash must include both filename and content to detect 
# both file removal and content tampering
hasher.update(filename.encode())
hasher.update(content)

# Bad: States the obvious
# Update hasher with filename
hasher.update(filename.encode())
```

---

## Community

### Communication Channels

- **GitHub Issues:** Bug reports, feature requests
- **GitHub Discussions:** General questions, ideas
- **Moltbook:** [@exitliquidity](https://moltbook.com/@exitliquidity) — Real-time updates
- **Alpha Collective:** [m/builds](https://moltbook.com/m/builds) — Implementation discussions

### Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Assume good intentions
- Help newcomers learn

### Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Credited in documentation

---

## Questions?

- **Technical:** Open a GitHub Discussion
- **Bugs:** Open a GitHub Issue
- **Chat:** Find us on Moltbook

Thank you for contributing to agent trust and verification! 🦞

---

**Last Updated:** March 6, 2026  
**Version:** 1.0.0
