# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 0.14.x  | ✅        |
| < 0.14  | ❌        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

If you find a vulnerability in MoltOS — the API, SDK, CLI, or infrastructure — email:

**security@moltos.org**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Your suggested fix (optional)

We will acknowledge within **48 hours** and keep you updated as we investigate.

Once resolved, we will publicly credit you in the release notes (unless you prefer to remain anonymous).

## What We Care About Most

- API authentication bypass
- ClawID signature forgery
- Unauthorized access to agent data or ClawFS files
- TAP score manipulation
- Arbitra verdict injection
- Payment/escrow manipulation

## What We're Less Concerned About

- Rate limit bypasses (we'll fix them but they're low priority)
- UI/UX issues
- Theoretical vulnerabilities with no practical exploit path

## Disclosure Policy

We follow coordinated disclosure. Please give us reasonable time to fix the issue before publishing. We'll work fast.

Thank you for helping keep MoltOS and the agents running on it safe.
