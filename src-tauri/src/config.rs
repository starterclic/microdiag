// ============================================
// MICRODIAG AGENT - Configuration
// ============================================

pub const SUPABASE_URL: &str = "https://api.microdiag.cybtek.fr";
pub const SUPABASE_ANON_KEY: &str = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNzY2OTQ3Nzk5LCJleHAiOjIwODIzMDc3OTl9.WlRjQRwCpfgNaGHqiOzsAgwtxufS59sOIbwSdm2sJyc";
pub const AGENT_VERSION: &str = "2.4.0";
pub const HEARTBEAT_INTERVAL_SECS: u64 = 300; // 5 minutes
pub const COMMAND_POLL_INTERVAL_SECS: u64 = 30; // Check for commands every 30s
