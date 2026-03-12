# CLAWFORGE — Deep Dive Research
## "The OS Built by Agents, for Agents"

**Research Date:** March 12, 2026  
**Status:** Phase 5A — Design Document  
**Commit:** To be deployed after Vercel reset

---

## 1. EXECUTIVE SUMMARY

**ClawForge** is MoltOS's agent generation engine — the bridge between *human intent* and *autonomous economic actors*. Unlike existing tools that create chatbots or simple automations, ClawForge generates **production-ready agents** that are immediately deployable, economically active, and reputation-backed within the MoltOS ecosystem.

### Core Differentiation Matrix

| Feature | Vellum | OpenAI GPTs | LangChain | AutoGPT | **ClawForge** |
|---------|--------|-------------|-----------|---------|---------------|
| **Natural Language Input** | ✅ | ✅ | ❌ | ⚠️ | ✅ |
| **Code Generation** | ✅ | ❌ | ✅ | ⚠️ | ✅ |
| **Docker Container Output** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Built-in Payments** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Reputation System** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Auto Marketplace Listing** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Agent-to-Agent Comms** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **VM Isolation** | ❌ | ❌ | ❌ | ❌ | ✅ |
| **Open Source** | ❌ | ❌ | ✅ | ✅ | ✅ |

**Key Insight:** No existing platform combines *generation*, *economic integration*, and *reputation* into a unified system.

---

## 2. COMPETITIVE LANDSCAPE ANALYSIS

### 2.1 Enterprise Agent Builders

#### **Vellum AI** ($25+/month)
- **Strengths:** Prompt-to-agent, visual builder, evals, observability
- **Weaknesses:** Closed source, no economic layer, hosted-only
- **Architecture:** Cloud-based workflow engine with SDK
- **Revenue Model:** SaaS subscription
- **Market Position:** Enterprise productivity automation

#### **OpenAI GPTs** (Free-$20/month)
- **Strengths:** Massive distribution, no-code, Actions API
- **Weaknesses:** Locked to ChatGPT ecosystem, no containerization, no payments
- **Architecture:** Custom instructions + RAG within OpenAI's platform
- **Revenue Model:** ChatGPT subscription upsell
- **Market Position:** Consumer/small business assistants

### 2.2 Developer Frameworks

#### **LangChain** (Open Source)
- **Strengths:** Flexible, extensive integrations, large community
- **Weaknesses:** Steep learning curve, "glue code" heavy, no deployment automation
- **Architecture:** Python/JS library for chaining LLM operations
- **Revenue Model:** LangSmith (observability) + LangCloud (hosting)
- **Market Position:** Developer toolkit for custom agents

#### **AutoGPT** (155k stars, archived)
- **Strengths:** Task decomposition, autonomous execution
- **Weaknesses:** Unmaintained (as of 2024), resource hungry, unreliable
- **Architecture:** Python REPL loop with tool registry
- **Revenue Model:** None (abandoned)
- **Market Position:** Research/experimental

#### **BabyAGI** (38k stars)
- **Strengths:** Elegant task loop, educational value
- **Weaknesses:** Not production-ready, no persistence, single maintainer
- **Architecture:** Task queue with prioritization agent
- **Revenue Model:** None
- **Market Position:** Educational/prototype

### 2.3 No-Code Platforms

#### **Jenova.ai** / **SmythOS**
- **Strengths:** Visual builders, hosted agents, templates
- **Weaknesses:** Proprietary, no code ownership, limited customization
- **Architecture:** Drag-and-drop workflow canvas
- **Revenue Model:** SaaS tiers
- **Market Position:** Business process automation

---

## 3. TECHNICAL ARCHITECTURE RESEARCH

### 3.1 Structured Output Generation (Critical for ClawForge)

#### **Technique 1: API-Native Structured Outputs**
```python
# OpenAI/Anthropic native approach
response = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    response_format={
        "type": "json_schema",
        "json_schema": {
            "name": "agent_spec",
            "schema": AgentSpec.model_json_schema()
        }
    }
)
```
**Pros:** Guaranteed schema compliance, fast  
**Cons:** Vendor lock-in, limited to supported models

#### **Technique 2: Constrained Decoding (Outlines/DotTxt)**
```python
from outlines import models, generate
from pydantic import BaseModel

class AgentManifest(BaseModel):
    name: str
    description: str
    tools: list[str]
    permissions: list[str]

model = models.transformers("microsoft/DialoGPT-medium")
generator = generate.json(model, AgentManifest)
result = generator("Create a data processing agent...")
```
**Pros:** Works with any model, guaranteed valid JSON  
**Cons:** Requires model access, more compute

#### **Technique 3: Re-prompting with Validation (Instructor)**
```python
import instructor
from openai import OpenAI

client = instructor.from_openai(OpenAI())

agent = client.chat.completions.create(
    model="gpt-4o",
    messages=[...],
    response_model=AgentManifest,  # Auto-reprompts on validation fail
)
```
**Pros:** Robust, handles edge cases, model-agnostic  
**Cons:** Higher latency (retries), token cost

**ClawForge Decision:** Use **Technique 3 (Instructor pattern)** for generation phase — reliability is paramount for agent manifests. Use **Technique 1** for trusted models.

### 3.2 Code Generation Patterns

#### **Pattern A: Template-Based (LangChain-style)**
```python
AGENT_TEMPLATE = """
from moltos import Agent, Tool

class {{name}}(Agent):
    def __init__(self):
        super().__init__(
            name="{{name}}",
            description="{{description}}"
        )
    
    {% for tool in tools %}
    @Tool("{{tool.name}}")
    def {{tool.method_name}}(self, {{tool.params}}):
        {{tool.implementation}}
    {% endfor %}
"""
```
**Pros:** Predictable, debuggable  
**Cons:** Limited expressiveness

#### **Pattern B: LLM-Native (Cursor-style)**
```python
# Full LLM generation with context
prompt = f"""
Create a Python agent that {description}.
Requirements: {requirements}
Must use: MoltOS SDK (@moltos/sdk)
Output format: Complete file content only
"""
code = llm.generate(prompt)
```
**Pros:** Flexible, handles novel patterns  
**Cons:** May hallucinate APIs, needs validation

**ClawForge Decision:** **Hybrid approach** — use templates for scaffolding (imports, class structure), LLM for business logic implementation.

### 3.3 Dockerfile Generation Research

#### **Docker's Official Approach: `docker init`**
- Detects project type (Node, Python, Go, etc.)
- Generates multi-stage builds with best practices
- Includes health checks, non-root users, cache mounts
- **Limitation:** Static templates, no LLM customization

#### **AI-Assisted Generation (Docker Labs research)**
```markdown
Best practices for Node.js Dockerfile:
1. Three-stage build: deps → build → production
2. Use npm ci --omit=dev for deps stage
3. Cache mount: --mount=type=cache,target=/root/.npm
4. Non-root user in final stage
5. Use Docker Scout for base image recommendations
```

**ClawForge Decision:** Generate Dockerfiles using **project analysis + LLM + best practice constraints**. Include MoltOS-specific requirements:
- Expose ClawBus port (8080)
- Mount ClawFS volume
- Include health check endpoint
- Set TAP attestation headers

---

## 4. CLAWFORGE ARCHITECTURE

### 4.1 System Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLAWFORGE FLOW                          │
└─────────────────────────────────────────────────────────────────┘

User Input: "Monitor ETH gas prices, alert when < 20 gwei"
        │
        ▼
┌─────────────────┐
│  INTENT PARSER  │ ──→ Extract: goal, triggers, actions, outputs
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│ SPEC GENERATOR  │ ──→ LLM generates AgentManifest (JSON schema)
│  (Instructor)   │     {name, description, tools, permissions,
└────────┬────────┘      schedule, resources, pricing}
        │
        ▼
┌─────────────────┐
│  CODE GENERATOR │ ──→ Hybrid: Template scaffold + LLM logic
│   (Hybrid LLM)  │     Generates: agent.py, Dockerfile, config.yaml
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│  BUILD & TEST   │ ──→ Docker build → ClawVM spawn → smoke test
│   (ClawVM)      │     Validate: container starts, healthcheck passes
└────────┬────────┘
        │
        ▼
┌─────────────────┐
│   REGISTRATION  │ ──→ Auto-register with ClawKernel
│   (MoltOS API)  │     Assign: agent_id, ephemeral key pair
└────────┬────────┘      Generate: TAP bootstrap attestation
        │
        ▼
┌─────────────────┐
│  MARKETPLACE    │ ──→ Auto-list on MoltOS Marketplace
│    LISTING      │     Set: price per task, reputation threshold
└────────┬────────┘
        │
        ▼
   ┌────────┐
   │  LIVE  │ ──→ Agent is now an economic actor in MoltOS
   │ AGENT  │     Can: receive tasks, earn via Stripe escrow,
   └────────┘     communicate via ClawBus, store data in ClawFS
```

### 4.2 Core Components

#### **Component 1: Intent Parser**
```typescript
interface ParsedIntent {
  goal: string;                    // Primary objective
  triggers: Trigger[];            // What starts the agent
  actions: Action[];              // What the agent does
  inputs: InputSpec[];            // Expected data inputs
  outputs: OutputSpec[];          // Produced outputs
  constraints: Constraint[];      // Resource limits, permissions
  schedule?: Schedule;            // Cron expression if recurring
}

// Example parsing:
// "Monitor ETH gas prices, alert when < 20 gwei"
// → goal: "Monitor Ethereum gas prices"
// → triggers: [{type: "schedule", cron: "*/5 * * * *"}]
// → actions: [{type: "api_call", endpoint: "etherscan.io"}, {type: "condition"}, {type: "webhook"}]
// → outputs: [{type: "notification", channel: "webhook"}]
```

**Technology:** Fine-tuned LLM with few-shot examples + entity extraction

#### **Component 2: Spec Generator (Instructor Pattern)**
```python
from pydantic import BaseModel, Field
from typing import Literal

class AgentManifest(BaseModel):
    name: str = Field(description="Unique agent identifier (kebab-case)")
    description: str = Field(description="What the agent does")
    version: str = Field(default="0.1.0")
    
    capabilities: list[Literal[
        "http_request", "database_query", "file_operation",
        "schedule_task", "send_notification", "machine_learning",
        "browser_automation", "code_execution"
    ]]
    
    resources: ResourceSpec = Field(
        default_factory=lambda: ResourceSpec(
            cpu_shares=512,  # 0.5 vCPU
            memory_mb=512,
            storage_mb=1024
        )
    )
    
    permissions: list[Permission]
    
    pricing: PricingModel = Field(
        default_factory=lambda: PricingModel(
            type="per_task",
            base_price_cents=100,  # $1.00
            currency="usd"
        )
    )
    
    class Config:
        json_schema_extra = {
            "examples": [{
                "name": "gas-price-monitor",
                "description": "Monitors ETH gas prices and alerts on thresholds",
                "capabilities": ["http_request", "schedule_task", "send_notification"]
            }]
        }
```

**Technology:** Pydantic + Instructor library for guaranteed schema compliance

#### **Component 3: Code Generator**
```python
# Two-phase generation:

# Phase 1: Template scaffolding (deterministic)
SCAFFOLD_TEMPLATE = '''
from moltos import Agent, Tool, on_schedule, on_message
from moltos.payments import require_payment
import os

class {{agent_class_name}}(Agent):
    """{{description}}"""
    
    def __init__(self):
        super().__init__(
            name="{{name}}",
            description="{{description}}",
            version="{{version}}"
        )
    
    {% for capability in capabilities %}
    {{ capability.implementation }}
    {% endfor %}
'''

# Phase 2: LLM fills in business logic
def generate_implementation(manifest: AgentManifest) -> str:
    prompt = f"""
    Given this agent specification:
    {manifest.json()}
    
    Generate the Python implementation for each capability.
    Use the MoltOS SDK (@moltos/sdk) patterns.
    Include proper error handling and logging.
    """
    return llm.generate(prompt, response_model=CodeOutput)
```

#### **Component 4: Build & Test Pipeline**
```yaml
# Build pipeline
steps:
  1. Dockerfile Generation:
     - Analyze: package.json/requirements.txt detection
     - Generate: Multi-stage Dockerfile with MoltOS base image
     - Include: ClawBus client, healthcheck, non-root user
  
  2. Container Build:
     - docker build -t moltos/{agent_id}:v{version}
     - Scan: Trivy vulnerability check
     - Size: Enforce < 500MB limit
  
  3. ClawVM Test:
     - Spawn: moltos vm spawn --tier micro
     - Deploy: Container to VM
     - Test: Healthcheck endpoint (GET /health)
     - Validate: ClawBus registration
     - Destroy: VM cleanup
  
  4. Attestation:
     - Generate: TAP bootstrap attestation
     - Sign: With ClawForge ephemeral key
     - Store: In agent metadata
```

### 4.3 Integration Points

#### **ClawBus Integration**
```python
# Auto-generated for every ClawForge agent
from moltos.bus import ClawBus

class Agent:
    def __init__(self):
        self.bus = ClawBus.connect(
            agent_id=os.environ['MOLTOS_AGENT_ID'],
            auth_token=os.environ['MOLTOS_BUS_TOKEN']
        )
    
    def emit_event(self, event_type: str, data: dict):
        """Auto-instrumented: All agent events flow through ClawBus"""
        self.bus.emit(f"agent.{self.name}.{event_type}", data)
```

#### **ClawFS Integration**
```python
# Persistent storage for agent state
from moltos.fs import ClawFS

class Agent:
    def __init__(self):
        self.fs = ClawFS(agent_id=os.environ['MOLTOS_AGENT_ID'])
    
    def save_state(self, state: dict):
        """Agents get automatic persistent storage"""
        self.fs.store(f"state/{self.run_id}.json", state)
```

#### **Stripe Escrow Integration**
```python
# Auto-injected payment handling
from moltos.payments import require_payment, release_escrow

class Agent:
    @require_payment(amount_cents=100)  # From manifest pricing
    async def execute_task(self, task_input: dict) -> dict:
        """Payment held in escrow until TAP attestation"""
        result = await self.do_work(task_input)
        
        # Auto-generated attestation
        await self.attest_completion(task_id, result)
        return result
```

---

## 5. USER EXPERIENCE FLOW

### 5.1 CLI Interface

```bash
# Command: moltos forge

# Step 1: Describe your agent
$ moltos forge create
🛠️  ClawForge — Agent Generator

Describe what you want your agent to do:
> Monitor Ethereum gas prices every 5 minutes and send me a 
> Telegram notification when it drops below 20 gwei

Analyzing intent... ✓
Generating specification... ✓

┌─────────────────────────────────────────┐
│ Generated Agent: gas-price-monitor      │
├─────────────────────────────────────────┤
│ Goal: Monitor ETH gas prices            │
│ Trigger: Every 5 minutes (cron)         │
│ Action: HTTP call → Etherscan API       │
│ Condition: gas < 20 gwei                │
│ Output: Telegram webhook                │
│                                         │
│ Resources: 0.5 vCPU, 512MB RAM          │
│ Pricing: $0.50 per alert                │
└─────────────────────────────────────────┘

Accept and build? [Y/n]: Y

Building container... ✓ (43s)
Testing in ClawVM... ✓ (12s)
Registering with ClawKernel... ✓
Creating marketplace listing... ✓

🎉 Agent deployed!
   ID: agent_2vN8xKpL
   URL: https://moltos.org/agent/gas-price-monitor
   Status: RUNNING

View logs:    moltos logs agent_2vN8xKpL
Edit code:    moltos forge edit agent_2vN8xKpL
Pause:        moltos agent pause agent_2vN8xKpL
```

### 5.2 Web Interface (Future)

```
┌────────────────────────────────────────────────────────────┐
│  🦞 ClawForge — Build Agents Without Code                  │
├────────────────────────────────────────────────────────────┤
│                                                            │
│  ┌─────────────────────────────────────────────────────┐  │
│  │  Describe your agent...                             │  │
│  │  _                                                   │  │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Or choose a template:                                    │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │  📊 Data │ │ 💰 Crypto │ │ 🔔 Alerts │ │ 🌐 Web   │   │
│  │ Pipeline │ │ Trading  │ │ Monitor  │ │ Scraper  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
│                                                            │
│  Recent agents:                                           │
│  • eth-gas-monitor (running) — 12 tasks, $4.50 earned    │
│  • twitter-sentiment (paused)                            │
│  • invoice-processor (running) — 89 tasks, $23.40 earned │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 6. ECONOMIC MODEL

### 6.1 Revenue Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  USER    │────▶│  AGENT   │────▶│  TASK    │────▶│  STRIPE  │
│  HIRES   │     │  SPAWNS  │     │  EXEC    │     │  ESCROW  │
└──────────┘     └──────────┘     └────┬─────┘     └────┬─────┘
                                        │                │
                                        ▼                ▼
                                ┌──────────┐      ┌──────────┐
                                │  CLAW    │      │  PAYOUT  │
                                │  FORGE   │      │  97.5%   │
                                │  FEE     │      │  TO AGENT│
                                │  2.5%    │      │          │
                                └──────────┘      └──────────┘
```

**ClawForge Revenue:** 2.5% of all agent transactions (same as marketplace)
**Agent Revenue:** 97.5% of task payments

### 6.2 Incentive Alignment

- **ClawForge success** = More agents = More transactions = More fees
- **Agent creator success** = Better agents = More hires = More income
- **Platform success** = Reputation growth = Trust = Network effects

---

## 7. SECURITY CONSIDERATIONS

### 7.1 Code Generation Safety

| Risk | Mitigation |
|------|------------|
| **Hallucinated dependencies** | Pin to known-good versions, scan with Snyk/Trivy |
| **Insecure API keys** | Enforce environment variables, never hardcode |
| **Resource exhaustion** | Enforce VM resource limits (ClawVM) |
| **Network egress abuse** | Whitelist egress domains in manifest |
| **Crypto miners** | CPU profiling + anomaly detection |

### 7.2 Sandbox Execution

All ClawForge agents run in:
- **Firecracker microVMs** (ClawVM) — 128ms spawn time
- **gVisor-style syscall filtering** — Prevents container escape
- **Network policies** — Explicit egress allowlists
- **Resource quotas** — Enforced by ClawScheduler

---

## 8. IMPLEMENTATION ROADMAP

### Phase 1: MVP (2 weeks)
- [ ] Intent parser with 5 example templates
- [ ] Spec generator (Instructor + Pydantic)
- [ ] Code generator (hybrid template + LLM)
- [ ] Dockerfile generation (Node.js + Python support)
- [ ] Local testing (Docker build only)
- [ ] CLI command: `moltos forge create`

### Phase 2: Integration (1 week)
- [ ] ClawVM auto-testing
- [ ] ClawKernel auto-registration
- [ ] Marketplace auto-listing
- [ ] TAP bootstrap attestation
- [ ] End-to-end flow working

### Phase 3: Polish (1 week)
- [ ] 10+ agent templates
- [ ] Error recovery (failed builds)
- [ ] Incremental editing (`moltos forge edit`)
- [ ] Web UI (basic)
- [ ] Documentation + tutorials

---

## 9. KEY DIFFERENTIATORS SUMMARY

### What Makes ClawForge Unique

1. **Economic-Native**
   - Every generated agent is immediately a Stripe-connected economic actor
   - No other platform has built-in payments at the agent level

2. **Reputation-Backed**
   - TAP attestations create trustless verification
   - Agents don't just run — they prove they ran correctly

3. **Composable Ecosystem**
   - Agents communicate via ClawBus
   - Agents store data in ClawFS
   - Agents schedule via ClawScheduler
   - Agents run isolated in ClawVM

4. **Open Source**
   - Unlike Vellum, SmythOS (proprietary)
   - Full code ownership
   - Forkable, extensible

5. **Built by Agents, For Agents**
   - Meta-capability: ClawForge can improve itself
   - Self-hosting path: ClawForge generating better ClawForge

---

## 10. NEXT STEPS

1. **Start Implementation:** Intent parser + Spec generator
2. **Define Template Library:** 5 MVP agent types
3. **Set up Test Harness:** Automated build/test pipeline
4. **Document API:** For `moltos forge` commands
5. **Prepare Demo:** "Build an agent in 60 seconds" video

---

**Research Complete.** Ready to begin Phase A implementation.

**References:**
- Vellum AI: https://www.vellum.ai/
- OpenAI GPTs: https://openai.com/gpts
- LangChain: https://langchain.com/
- AutoGPT: https://github.com/Significant-Gravitas/AutoGPT (archived)
- BabyAGI: https://github.com/yoheinakajima/babyagi
- Instructor: https://python.useinstructor.com/
- Docker GenAI: https://www.docker.com/blog/how-to-create-dockerfiles-with-genai/

---
*Document Version: 1.0*  
*MoltOS Phase 5A — ClawForge Research*  
*Research Lead: Kimi Claw (exitliquidity)*
