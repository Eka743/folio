import Foundation

/// Loopback TLS provisioning for the production bridge (127.0.0.1:17392).
///
/// Why TLS exists at all: browsers block `https://` pages from fetching
/// `http://127.0.0.1` as mixed content (Safari never issues the request),
/// so the helper must serve a TLS listener with a per-install loopback
/// certificate (CN/SAN scoped to 127.0.0.1 + localhost). The user trusts it
/// once via the Folio for Mac app; thereafter https:// Folio pages probe
/// `https://127.0.0.1:17392` first and fall back to plain HTTP only on
/// `http://localhost` development origins.
///
/// Actual TLS termination uses macOS SecureTransport and is exercised on
/// macOS CI / real Macs. Everything in this file is pure path/argument
/// construction so it is unit-tested on any platform without key material.
public enum BridgeTLS {
    /// Directory holding the per-install cert + key (~/.folio/bridge).
    public static func bridgeDirectory(home: URL) -> URL {
        home.appendingPathComponent(HelperConfig.bridgeDirName, isDirectory: true)
    }

    public static func certURL(home: URL) -> URL {
        bridgeDirectory(home: home).appendingPathComponent(HelperConfig.certFileName)
    }

    public static func keyURL(home: URL) -> URL {
        bridgeDirectory(home: home).appendingPathComponent(HelperConfig.keyFileName)
    }

    /// Fixed openssl invocation used to mint the loopback certificate.
    /// No untrusted input is ever interpolated: subject/SAN are constants.
    /// Key is written with 0600 by the provisioning script.
    public static func opensslArguments(certPath: String, keyPath: String) -> [String] {
        [
            "openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes",
            "-keyout", keyPath,
            "-out", certPath,
            "-days", "825",
            "-subj", "/CN=127.0.0.1",
            "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
        ]
    }

    /// Whether the provisioning script must run (cert or key missing).
    public static func needsProvisioning(certExists: Bool, keyExists: Bool) -> Bool {
        !certExists || !keyExists
    }
}
