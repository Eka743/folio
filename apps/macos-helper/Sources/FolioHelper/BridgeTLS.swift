import Foundation
#if os(macOS)
import Security
#endif

public enum BridgeTLSError: Error {
    case invalidPort
    case provisioningFailed(Int32)
    case identityImportFailed(Int32)
    case identityMissing
}

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
/// Actual TLS termination uses Network.framework in `LoopbackTLSProxy.swift`.
/// Path and fixed-argument construction stays platform-neutral and testable.
public enum BridgeTLS {
    // The PKCS#12 is only a compatibility container beside the 0600 PEM key,
    // not a security boundary. A non-empty value is required by
    // SecPKCS12Import on macOS even though LibreSSL accepts an empty password.
    private static let identityPassphrase = "folio-loopback-v02"
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

    public static func identityURL(home: URL) -> URL {
        bridgeDirectory(home: home).appendingPathComponent(HelperConfig.identityFileName)
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

    /// Fixed invocation that combines the generated certificate and private
    /// key into the in-memory identity format consumed by Network.framework.
    public static func pkcs12Arguments(certPath: String, keyPath: String, identityPath: String) -> [String] {
        [
            "openssl", "pkcs12", "-export",
            "-out", identityPath,
            "-inkey", keyPath,
            "-in", certPath,
            "-passout", "pass:\(identityPassphrase)",
        ]
    }

    /// Whether the provisioning script must run (cert or key missing).
    public static func needsProvisioning(certExists: Bool, keyExists: Bool) -> Bool {
        !certExists || !keyExists
    }


#if os(macOS)
    /// Provision the per-install certificate if needed and load its identity
    /// in memory. OpenSSL receives only fixed arguments and Folio-owned paths;
    /// no document data or browser input reaches this process.
    public static func loadOrCreateIdentity(home: URL) throws -> sec_identity_t {
        let fm = FileManager.default
        let dir = bridgeDirectory(home: home)
        let cert = certURL(home: home)
        let key = keyURL(home: home)
        let identity = identityURL(home: home)

        try fm.createDirectory(
            at: dir,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: dir.path)

        let recreateCertificate = needsProvisioning(
            certExists: fm.fileExists(atPath: cert.path),
            keyExists: fm.fileExists(atPath: key.path)
        )
        if recreateCertificate {
            try? fm.removeItem(at: cert)
            try? fm.removeItem(at: key)
            try? fm.removeItem(at: identity)
            try runOpenSSL(opensslArguments(certPath: cert.path, keyPath: key.path))
        }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: key.path)
        try fm.setAttributes([.posixPermissions: 0o644], ofItemAtPath: cert.path)

        if recreateCertificate || !fm.fileExists(atPath: identity.path) {
            try? fm.removeItem(at: identity)
            try runOpenSSL(pkcs12Arguments(
                certPath: cert.path,
                keyPath: key.path,
                identityPath: identity.path
            ))
        }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: identity.path)

        var imported: CFArray?
        var status = importIdentity(at: identity, into: &imported)
        if status != errSecSuccess {
            // Migrate a container made by the earlier empty-passphrase
            // prototype without replacing the user's already-trusted cert.
            try? fm.removeItem(at: identity)
            try runOpenSSL(pkcs12Arguments(
                certPath: cert.path,
                keyPath: key.path,
                identityPath: identity.path
            ))
            try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: identity.path)
            status = importIdentity(at: identity, into: &imported)
        }
        guard status == errSecSuccess else {
            throw BridgeTLSError.identityImportFailed(Int32(status))
        }
        guard let items = imported as? [[String: Any]],
              let first = items.first,
              let rawIdentity = first[kSecImportItemIdentity as String],
              CFGetTypeID(rawIdentity as CFTypeRef) == SecIdentityGetTypeID() else {
            throw BridgeTLSError.identityMissing
        }
        let secIdentity = rawIdentity as! SecIdentity
        guard let identity = sec_identity_create(secIdentity) else {
            throw BridgeTLSError.identityMissing
        }
        return identity
    }

    private static func runOpenSSL(_ command: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/openssl")
        process.arguments = Array(command.dropFirst())
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else {
            throw BridgeTLSError.provisioningFailed(process.terminationStatus)
        }
    }

    private static func importIdentity(at url: URL, into imported: inout CFArray?) -> OSStatus {
        guard let data = try? Data(contentsOf: url) else { return errSecIO }
        var options: [String: Any] = [
            kSecImportExportPassphrase as String: identityPassphrase,
        ]
        if #available(macOS 15.0, *) {
            options[kSecImportToMemoryOnly as String] = true
        }
        return SecPKCS12Import(data as CFData, options as CFDictionary, &imported)
    }
#endif
}
