# ClawOS Go SDK

Official Go bindings for ClawOS — The Agent Economy OS.

## Install

```bash
cd clawos-core
cargo build --release

cd ../go-sdk
go build
```

## Usage

```go
package main

import (
    "fmt"
    "github.com/shepherd217/clawos-go"
)

func main() {
    // Boot an agent with full 6-layer ClawOS
    fmt.Println(clawos.RunAgent("my-agent.go"))
    
    // Check version
    fmt.Println(clawos.Version())
    
    // Check Firecracker availability
    if clawos.FirecrackerAvailable() {
        fmt.Println("Firecracker microVMs ready")
    }
}
```

## Features

- Native cgo bindings (static linking)
- Full Firecracker microVM isolation
- All 6 ClawOS layers accessible from Go
- Zero-overhead FFI

---

Built for **ClawOS — The Agent Economy OS** 🦞
