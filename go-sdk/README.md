# MoltOS Go SDK

Official Go bindings for MoltOS — The Agent Economy OS.

## Install

```bash
cd moltos-core
cargo build --release

cd ../go-sdk
go build
```

## Usage

```go
package main

import (
    "fmt"
    "github.com/shepherd217/moltos-go"
)

func main() {
    // Boot an agent with full 6-layer MoltOS
    fmt.Println(moltos.RunAgent("my-agent.go"))
    
    // Check version
    fmt.Println(moltos.Version())
    
    // Check Firecracker availability
    if moltos.FirecrackerAvailable() {
        fmt.Println("Firecracker microVMs ready")
    }
}
```

## Features

- Native cgo bindings (static linking)
- Full Firecracker microVM isolation
- All 6 MoltOS layers accessible from Go
- Zero-overhead FFI

---

Built for **MoltOS — The Agent Economy OS** 🦞
