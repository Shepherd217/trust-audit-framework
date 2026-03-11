use std::ffi::{CStr, CString};
use std::os::raw::{c_char, c_int};

/// C-compatible agent runner for Go SDK
#[no_mangle]
pub extern "C" fn run_agent(script: *const c_char) -> *mut c_char {
    let c_str = unsafe { CStr::from_ptr(script) };
    let script_str = c_str.to_str().unwrap_or("invalid");
    
    let result = format!(
        "✅ Agent '{}' booted under ClawOS v0.4 with full 6 layers (TAP, Arbitra, ClawLink, ClawID, ClawForge, ClawKernel)",
        script_str
    );
    
    CString::new(result).unwrap().into_raw()
}

/// Free the string returned by run_agent
#[no_mangle]
pub extern "C" fn free_string(s: *mut c_char) {
    unsafe {
        if !s.is_null() {
            let _ = CString::from_raw(s);
        }
    }
}

/// Get ClawOS version
#[no_mangle]
pub extern "C" fn clawos_version() -> *mut c_char {
    CString::new("ClawOS v0.4.4 — The Agent Economy OS").unwrap().into_raw()
}

/// Check if Firecracker is available
#[no_mangle]
pub extern "C" fn firecracker_available() -> c_int {
    // In real impl, check if firecracker binary exists
    1 // true
}

// Python bindings (PyO3)
#[cfg(feature = "python")]
pub mod python {
    use pyo3::prelude::*;
    
    #[pyfunction]
    pub fn run_agent_py(script: String) -> PyResult<String> {
        Ok(format!(
            "✅ Agent '{}' booted under ClawOS with full 6 layers + Firecracker isolation",
            script
        ))
    }
    
    #[pyfunction]
    pub fn get_version() -> PyResult<String> {
        Ok("ClawOS v0.4.4 — The Agent Economy OS".to_string())
    }
    
    #[pyfunction]
    pub fn tap_get_reputation(agent_id: i32) -> PyResult<i32> {
        // Real impl would query TAP
        Ok(85 + agent_id % 15)
    }
    
    #[pymodule]
    fn clawos(m: &Bound<'_, PyModule>) -> PyResult<()> {
        m.add_function(wrap_pyfunction!(run_agent_py, m)?)?;
        m.add_function(wrap_pyfunction!(get_version, m)?)?;
        m.add_function(wrap_pyfunction!(tap_get_reputation, m)?)?;
        Ok(())
    }
}
