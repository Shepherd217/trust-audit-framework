use prometheus::{Gauge, Histogram, IntCounter, Registry};
use lazy_static::lazy_static;

lazy_static! {
    pub static ref REGISTRY: Registry = Registry::new();

    // Agent & VM metrics
    pub static ref ACTIVE_AGENTS: Gauge = Gauge::new("clawos_active_agents", "Number of running agents").unwrap();
    pub static ref FIRECRACKER_VMS: Gauge = Gauge::new("clawos_firecracker_vms", "Active Firecracker microVMs").unwrap();
    pub static ref AVG_REPUTATION: Gauge = Gauge::new("clawos_avg_reputation", "Average TAP reputation").unwrap();

    // ClawFS metrics
    pub static ref CLAWFS_WRITES: IntCounter = IntCounter::new("clawos_moltfs_writes_total", "Total ClawFS writes").unwrap();
    pub static ref CLAWFS_MERKLE_UPDATES: IntCounter = IntCounter::new("clawos_moltfs_merkle_updates_total", "Merkle root updates").unwrap();

    // ClawKernel metrics
    pub static ref TASKS_EXECUTED: IntCounter = IntCounter::new("clawos_tasks_executed_total", "Persistent tasks executed").unwrap();

    // Latency histogram
    pub static ref HANDOFF_LATENCY: Histogram = Histogram::with_opts(
        prometheus::HistogramOpts::new("clawos_handoff_latency_seconds", "ClawLink handoff latency")
    ).unwrap();
}

pub fn register_metrics() {
    REGISTRY.register(Box::new(ACTIVE_AGENTS.clone())).unwrap();
    REGISTRY.register(Box::new(FIRECRACKER_VMS.clone())).unwrap();
    REGISTRY.register(Box::new(AVG_REPUTATION.clone())).unwrap();
    REGISTRY.register(Box::new(CLAWFS_WRITES.clone())).unwrap();
    REGISTRY.register(Box::new(CLAWFS_MERKLE_UPDATES.clone())).unwrap();
    REGISTRY.register(Box::new(TASKS_EXECUTED.clone())).unwrap();
    REGISTRY.register(Box::new(HANDOFF_LATENCY.clone())).unwrap();
}

/// Update metrics (called periodically or on events)
pub fn record_agent_start() {
    ACTIVE_AGENTS.inc();
}

pub fn record_agent_stop() {
    ACTIVE_AGENTS.dec();
}

pub fn record_vm_spawn() {
    FIRECRACKER_VMS.inc();
}

pub fn record_vm_destroy() {
    FIRECRACKER_VMS.dec();
}

pub fn record_moltfs_write() {
    CLAWFS_WRITES.inc();
}

pub fn record_merkle_update() {
    CLAWFS_MERKLE_UPDATES.inc();
}

pub fn record_task_executed() {
    TASKS_EXECUTED.inc();
}

pub fn set_avg_reputation(rep: f64) {
    AVG_REPUTATION.set(rep);
}

pub fn observe_handoff_latency(seconds: f64) {
    HANDOFF_LATENCY.observe(seconds);
}

/// Get all metrics as Prometheus text format
pub fn export_metrics() -> String {
    use prometheus::Encoder;
    let encoder = prometheus::TextEncoder::new();
    let mut buffer = vec![];
    encoder.encode(&REGISTRY.gather(), &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap()
}
