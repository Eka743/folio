#if os(macOS)
import Foundation
import Security

/// The small amount of setup that must happen before the helper can serve the
/// HTTPS loopback bridge. All paths and OpenSSL arguments are Folio constants;
/// no browser input or document content reaches this code.
public enum BridgeSetupStatus: Equatable {
    case ready
    case needsApproval
    case failed(String)
}

public enum BridgeSetup {
    public static let bridgeDirectoryName = ".folio/bridge"
    public static let certificateName = "folio-bridge-cert.pem"
    public static let keyName = "folio-bridge-key.pem"
    public static let identityName = "folio-bridge-identity.p12"
    public static let setupMarkerName = "setup-ready"
    public static let commonName = "Folio Loopback Bridge (folio-bridge)"
    private static let identityPassphrase = "folio-loopback-v02"

    public static var directoryURL: URL {
        FileManager.default.homeDirectoryForCurrentUser
            .appendingPathComponent(bridgeDirectoryName, isDirectory: true)
    }

    public static var certificateURL: URL {
        directoryURL.appendingPathComponent(certificateName)
    }

    public static var keyURL: URL {
        directoryURL.appendingPathComponent(keyName)
    }

    public static var identityURL: URL {
        directoryURL.appendingPathComponent(identityName)
    }

    public static var setupMarkerURL: URL {
        directoryURL.appendingPathComponent(setupMarkerName)
    }

    /// Generate the per-install certificate if it does not exist. This is
    /// intentionally automatic and does not change any system trust settings.
    @discardableResult
    public static func prepare() -> BridgeSetupStatus {
        do {
            try ensureCertificate()
            if isTrusted() {
                try markReady()
                return .ready
            }
            return .needsApproval
        } catch {
            return .failed("Folio could not prepare its secure local connection.")
        }
    }

    /// Add this self-signed loopback root to the signed-in user's trust
    /// settings through Apple's Security framework. macOS may show an
    /// authentication prompt; Folio never edits TCC or asks the user to open
    /// Keychain Access.
    public static func approveTrust() -> BridgeSetupStatus {
        do {
            try ensureCertificate()
            guard let certificate = loadCertificate() else {
                return .failed("Folio could not read its secure connection certificate.")
            }
            if !isTrusted(certificate: certificate) {
                let status = SecTrustSettingsSetTrustSettings(
                    certificate,
                    SecTrustSettingsDomain.user,
                    nil
                )
                guard status == errSecSuccess else {
                    return .failed("macOS did not approve Folio's secure local connection.")
                }
            }
            guard isTrusted(certificate: certificate) else {
                return .failed("Folio could not verify its secure local connection.")
            }
            try markReady()
            return .ready
        } catch {
            return .failed("Folio could not finish secure connection setup.")
        }
    }

    public static func isTrusted() -> Bool {
        guard let certificate = loadCertificate() else { return false }
        return isTrusted(certificate: certificate)
    }

    private static func ensureCertificate() throws {
        let fm = FileManager.default
        try fm.createDirectory(
            at: directoryURL,
            withIntermediateDirectories: true,
            attributes: [.posixPermissions: 0o700]
        )
        try fm.setAttributes([.posixPermissions: 0o700], ofItemAtPath: directoryURL.path)

        let needsNewCertificate = !fm.fileExists(atPath: certificateURL.path) ||
            !fm.fileExists(atPath: keyURL.path) ||
            !hasCurrentSubject()
        if needsNewCertificate {
            try? fm.removeItem(at: certificateURL)
            try? fm.removeItem(at: keyURL)
            try? fm.removeItem(at: identityURL)
            try? fm.removeItem(at: setupMarkerURL)
            try runOpenSSL([
                "req", "-x509", "-newkey", "rsa:2048", "-nodes",
                "-keyout", keyURL.path,
                "-out", certificateURL.path,
                "-days", "825",
                "-subj", "/CN=\(commonName)",
                "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost",
            ])
        }
        try fm.setAttributes([.posixPermissions: 0o600], ofItemAtPath: keyURL.path)
        try fm.setAttributes([.posixPermissions: 0o644], ofItemAtPath: certificateURL.path)
    }

    private static func runOpenSSL(_ arguments: [String]) throws {
        let process = Process()
        process.executableURL = URL(fileURLWithPath: "/usr/bin/openssl")
        process.arguments = arguments
        process.standardOutput = FileHandle.nullDevice
        process.standardError = FileHandle.nullDevice
        try process.run()
        process.waitUntilExit()
        guard process.terminationStatus == 0 else { throw SetupError.provisioning }
    }

    private static func loadCertificate() -> SecCertificate? {
        guard let pem = try? String(contentsOf: certificateURL, encoding: .utf8) else {
            return nil
        }
        let body = pem
            .replacingOccurrences(of: "-----BEGIN CERTIFICATE-----", with: "")
            .replacingOccurrences(of: "-----END CERTIFICATE-----", with: "")
        guard let der = Data(base64Encoded: body, options: [.ignoreUnknownCharacters]) else {
            return nil
        }
        return SecCertificateCreateWithData(nil, der as CFData)
    }

    private static func hasCurrentSubject() -> Bool {
        guard let certificate = loadCertificate(),
              let subject = SecCertificateCopySubjectSummary(certificate) as String?
        else { return false }
        return subject == commonName
    }

    private static func markReady() throws {
        try Data("ready\n".utf8).write(to: setupMarkerURL, options: .atomic)
        try FileManager.default.setAttributes(
            [.posixPermissions: 0o600],
            ofItemAtPath: setupMarkerURL.path
        )
    }

    private static func isTrusted(certificate: SecCertificate) -> Bool {
        var settings: CFArray?
        let status = SecTrustSettingsCopyTrustSettings(
            certificate,
            SecTrustSettingsDomain.user,
            &settings
        )
        return status == errSecSuccess
    }

    private enum SetupError: Error {
        case provisioning
    }
}
#endif
