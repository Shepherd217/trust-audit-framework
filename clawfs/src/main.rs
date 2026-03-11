use clap::Parser;
use anyhow::Result;

#[derive(Parser)]
#[command(name = "clawfs")]
struct Cli {
    #[command(subcommand)]
    cmd: Commands,
}

#[derive(clap::Subcommand)]
enum Commands {
    Write { key: String, data: String },
    Read { key: String },
    Snapshot,
    Replicate { target: String },
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    let mut fs = clawfs::get_clawfs_instance();

    match cli.cmd {
        Commands::Write { key, data } => {
            let hash = fs.write(&key, data.as_bytes())?;
            println!("✅ Written. Content hash: {}", hash);
            println!("   Merkle root: {}", fs.merkle_root());
        }
        Commands::Read { key } => {
            let data = fs.read(&key)?;
            println!("📄 Content: {}", String::from_utf8_lossy(&data));
        }
        Commands::Snapshot => {
            let snap = fs.snapshot();
            println!("📸 Snapshot created: {}", snap);
            println!("   Snapshots in history: {}", fs.snapshot_history.len());
        }
        Commands::Replicate { target } => {
            fs.replicate_to(&target).await?;
            println!("✅ Replicated to {}", target);
        }
    }
    Ok(())
}
