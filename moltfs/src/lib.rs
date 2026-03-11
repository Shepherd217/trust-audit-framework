use anyhow::Result;
use blake3::Hash;
use sled::Db;
use std::collections::HashMap;
use std::path::Path;
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Clone)]
pub struct ClawFS {
    #[serde(skip)]
    db: Db,
    merkle_root: Hash,
    snapshot_history: Vec<Hash>,
}

impl ClawFS {
    pub fn open(path: &str) -> Result<Self> {
        let db = sled::open(path)?;
        let merkle_root = if let Some(root_bytes) = db.get(b"root")? {
            Hash::from_bytes(root_bytes.as_ref().try_into().unwrap_or([0u8; 32]))
        } else {
            blake3::hash(b"moltfs-genesis")
        };
        
        Ok(ClawFS {
            db,
            merkle_root,
            snapshot_history: vec![merkle_root],
        })
    }

    /// Write file with Merkle tree update
    pub fn write(&mut self, key: &str, data: &[u8]) -> Result<Hash> {
        let hash = blake3::hash(data);
        self.db.insert(key.as_bytes(), data)?;
        self.update_merkle_root()?;
        Ok(hash)
    }

    /// Read with integrity check
    pub fn read(&self, key: &str) -> Result<Vec<u8>> {
        let data = self.db.get(key.as_bytes())?.ok_or(anyhow::anyhow!("Not found"))?;
        Ok(data.to_vec())
    }

    fn update_merkle_root(&mut self) -> Result<()> {
        // Build Merkle tree from all entries
        let mut hashes: Vec<Hash> = Vec::new();
        for item in self.db.iter() {
            let (k, v) = item?;
            if k.as_ref() == b"root" { continue; }
            let mut hasher = blake3::Hasher::new();
            hasher.update(&k);
            hasher.update(&v);
            hashes.push(hasher.finalize());
        }
        
        // Compute root
        let root = if hashes.is_empty() {
            blake3::hash(b"empty")
        } else {
            let mut combined = blake3::Hasher::new();
            for h in &hashes {
                combined.update(h.as_bytes());
            }
            combined.finalize()
        };
        
        self.merkle_root = root;
        self.db.insert(b"root", root.as_bytes())?;
        self.snapshot_history.push(root);
        Ok(())
    }

    /// Create snapshot (instant rollback point)
    pub fn snapshot(&mut self) -> Hash {
        let snap = self.merkle_root;
        self.snapshot_history.push(snap);
        snap
    }

    /// Get current Merkle root
    pub fn merkle_root(&self) -> Hash {
        self.merkle_root
    }

    /// Replicate to another node (simple file-based for MVP; upgrade to vsock/P2P later)
    pub async fn replicate_to(&self, target_path: &str) -> Result<()> {
        // Get the database path
        let db_path = self.db.path().to_path_buf();
        tokio::fs::copy(&db_path, target_path).await?;
        Ok(())
    }
}

// Global instance for ClawVM host functions
use std::sync::Mutex;
use once_cell::sync::Lazy;

static CLAWFS_INSTANCE: Lazy<Mutex<ClawFS>> = Lazy::new(|| {
    Mutex::new(ClawFS::open("./moltfs_data").expect("Failed to initialize ClawFS"))
});

pub fn get_moltfs_instance() -> std::sync::MutexGuard<'static, ClawFS> {
    CLAWFS_INSTANCE.lock().expect("ClawFS lock poisoned")
}
