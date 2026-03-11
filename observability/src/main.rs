use warp::Filter;
use observability::register_metrics;

#[tokio::main]
async fn main() {
    register_metrics();
    println!("📡 ClawOS Observability started — Prometheus on http://localhost:9090/metrics");

    let metrics_route = warp::path!("metrics")
        .map(|| {
            observability::export_metrics()
        });

    let health_route = warp::path!("health")
        .map(|| "ClawOS Observability OK");

    let routes = metrics_route.or(health_route);

    println!("🦞 ClawOS — The Agent Economy OS");
    println!("   Prometheus: http://localhost:9090/metrics");
    println!("   Health:     http://localhost:9090/health");

    warp::serve(routes)
        .run(([127, 0, 0, 1], 9090))
        .await;
}
