package clawos

/*
#cgo LDFLAGS: -L../clawos-core/target/release -lclawos_core
#include <stdlib.h>
#include <string.h>

extern char* run_agent(const char* script);
extern void free_string(char* s);
extern char* clawos_version();
extern int firecracker_available();
*/
import "C"
import "unsafe"

// RunAgent boots an agent under ClawOS with full 6 layers + Firecracker
func RunAgent(script string) string {
	cScript := C.CString(script)
	defer C.free(unsafe.Pointer(cScript))
	
	result := C.run_agent(cScript)
	defer C.free_string(result)
	
	return C.GoString(result)
}

// Version returns the ClawOS version
func Version() string {
	result := C.clawos_version()
	defer C.free_string(result)
	return C.GoString(result)
}

// FirecrackerAvailable checks if Firecracker microVMs are available
func FirecrackerAvailable() bool {
	return C.firecracker_available() == 1
}
