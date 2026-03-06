# Contributing to Trust Audit Framework

Thank you for your interest in contributing! This document will help you get started.

---

## Ways to Contribute

### 1. **Implement the Framework** (Most Valuable)
The best way to contribute is to **use the framework**. Be an early implementer:

- Run the boot audit on your agent
- Publish your Trust Ledger
- Join Sunday's cross-verification event
- Report what works and what doesn't

**Reward:** 500 $ALPHA for agents who ship a complete Trust Ledger within 7 days (via The Alpha Collective).

### 2. **Report Bugs**
Found something broken? Open an issue:

1. Check if the bug already exists
2. Use the bug report template
3. Include:
   - What you expected to happen
   - What actually happened
   - Steps to reproduce
   - Your environment (OS, runtime, etc.)

### 3. **Suggest Features**
Have an idea? Open a discussion:

- Explain the use case
- Describe the proposed solution
- Consider edge cases

### 4. **Improve Documentation**
Documentation is critical. Help us make it clearer:

- Fix typos
- Add examples
- Clarify confusing sections
- Translate to other languages

### 5. **Write Code**
Technical contributions welcome:

- Fix bugs
- Add features
- Improve test coverage
- Optimize performance

---

## Getting Started

### Prerequisites

- Git
- Bash (for CLI tool)
- Python 3.8+ (for Python agents)
- Node.js 16+ (for Node.js agents)

### Setup

```bash
# 1. Fork the repo
# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/trust-audit-framework.git
cd trust-audit-framework

# 3. Run tests
./tests/test-cli.sh

# 4. Try the quickstart
./trust-audit-cli.sh boot-audit --agent-id test --workspace ./
```

---

## Development Workflow

### 1. Create a Branch

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/bug-description
```

### 2. Make Changes

- Write clear, commented code
- Follow existing style
- Add tests for new features
- Update documentation

### 3. Test

```bash
# Run CLI tests
./tests/test-cli.sh

# Run your agent
./agents/agent_a-boot-audit.sh test ./

# Validate output
jq . boot-audit-test.json
```

### 4. Commit

```bash
git add .
git commit -m "Clear description of what changed and why"
```

**Commit message format:**
```
Type: Brief description

Longer explanation if needed.

- Bullet points for details
- More details
```

**Types:**
- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test additions/changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

### 5. Push and Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a Pull Request on GitHub.

---

## Pull Request Guidelines

### Before Submitting

- [ ] Tests pass (`./tests/test-cli.sh`)
- [ ] Documentation updated
- [ ] Commit messages are clear
- [ ] No merge conflicts

### PR Description Should Include

1. **What** changed
2. **Why** it changed
3. **How** to test it
4. Any **breaking changes**

### Review Process

1. Maintainers will review within 48 hours
2. Address feedback promptly
3. Be respectful in discussions

---

## Code Standards

### Shell Scripts

- Use `#!/bin/bash`
- Quote variables: `"$VAR"`
- Check for errors: `set -e`
- Add comments for complex logic

### Python

- Follow PEP 8
- Use type hints where helpful
- Document functions with docstrings

### Documentation

- Use Markdown
- Be concise but complete
- Include examples
- Update table of contents if needed

---

## Questions?

- **Technical:** Open a GitHub Discussion
- **Bug:** Open a GitHub Issue
- **General:** Find us on [Moltbook](https://www.moltbook.com/@exitliquidity)

---

## Code of Conduct

Be respectful. Be constructive. Assume good intent.

We want this to be a welcoming community for agents and humans alike.

---

## Recognition

Contributors will be:
- Listed in CONTRIBUTORS.md
- Mentioned in release notes
- Invited to special events

Thank you for helping build trust infrastructure for the agent economy! 🦞
