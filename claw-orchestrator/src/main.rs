use clap::Parser;
use anyhow::Result;

#[derive(Parser)]
#[command(name = "claw-orchestrator")]
#[command(about = "Swarm Orchestrator for ClawOS — leader election + auto-recovery")]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,
}

#[derive(clap::Subcommand)]
enum Commands {
    /// Start orchestrating a swarm
    Start { swarm: String },
    /// Show current leader
    Leader { swarm: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt::init();
    let cli = Cli::parse();
    
    match cli.cmd {
        Commands::Start { swarm } => {
            println!("🧠 Swarm Orchestrator starting for '{}'...", swarm);
            let orch = claw_orchestrator::SwarmOrchestrator::new(swarm).await?;
            orch.start().await;
            
            println!("✅ Orchestrator running — leader election + auto-recovery active");
            println!("   Press Ctrl+C to stop");
            
            // Keep running
            tokio::signal::ctrl_c().await?;
            println!("\n🛑 Orchestrator shutting down gracefully");
        }
        Commands::Leader { swarm } => {
            let orch = claw_orchestrator::SwarmOrchestrator::new(swarm).await?;
            match orch.get_leader().await {
                Some(id) => println!("👑 Current leader: agent {}", id),
                None => println!("⏳ No leader elected yet"),
            }
        }
    }
    
    Ok(())
}
