use criterion::{criterion_group, criterion_main, Criterion, Throughput, BenchmarkId};
use std::time::Duration;

fn stress_orchestrator(c: &mut Criterion) {
    let mut group = c.benchmark_group("orchestrator_throughput");
    group.throughput(Throughput::Elements(100));
    group.measurement_time(Duration::from_secs(10));
    
    group.bench_function("100_agent_handoff_throughput", |b| {
        b.iter(|| {
            // Simulate 100 concurrent agent operations
            for i in 0..100 {
                observability::record_agent_start();
                observability::record_task_executed();
                if i % 10 == 0 {
                    observability::record_merkle_update();
                }
            }
        });
    });
    
    group.finish();
}

fn stress_moltfs(c: &mut Criterion) {
    let mut group = c.benchmark_group("moltfs_throughput");
    group.throughput(Throughput::Elements(10000));
    group.measurement_time(Duration::from_secs(30));
    
    group.bench_function("sustained_10k_writes", |b| {
        b.iter(|| {
            for _ in 0..10000 {
                observability::record_moltfs_write();
            }
        });
    });
    
    group.finish();
}

fn stress_reputation_distribution(c: &mut Criterion) {
    let mut group = c.benchmark_group("reputation_distribution");
    
    for agent_count in [10, 50, 100, 500].iter() {
        group.bench_with_input(
            BenchmarkId::new("leader_election", agent_count),
            agent_count,
            |b, &n| {
                b.iter(|| {
                    // Simulate leader election with n agents
                    let mut max_rep = 0;
                    for i in 0..n {
                        let rep = 50 + (i * 2) % 50;
                        if rep > max_rep {
                            max_rep = rep;
                        }
                    }
                    max_rep
                });
            },
        );
    }
    
    group.finish();
}

criterion_group!(benches, stress_orchestrator, stress_moltfs, stress_reputation_distribution);
criterion_main!(benches);
