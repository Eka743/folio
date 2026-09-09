#if os(macOS)
import Foundation
import AppKit
#if canImport(ServiceManagement)
import ServiceManagement
#endif

/// Bridge child-process supervision + Open at Login (macOS only).
/// The helper binary is bundled inside Folio.app/Contents/MacOS/ and spawned
/// with fixed arguments — never with browser-supplied input.
@available(macOS 13, *)
public final class BridgeProcess: ObservableObject {
    @Published public private(set) var running = false
    @Published public private(set) var healthy = false
    @Published public private(set) var setupStatus: BridgeSetupStatus = .needsApproval
    @Published public private(set) var capabilities: [String: Bool] = [:]
    @Published public private(set) var permissionMessage: String?
    private var task: Process?
    private var stopping = false
    private var restartAttempts = 0
    private var restartWorkItem: DispatchWorkItem?

    public init() {}

    public var isReady: Bool {
        running && healthy && setupStatus == .ready
    }

    /// Path of the bundled helper relative to the app bundle.
    public static func bundledHelperURL() -> URL? {
        Bundle.main.bundleURL
            .appendingPathComponent("Contents/MacOS/\(FolioMac.helperExecutableName)")
    }

    public func prepareAndStart() {
        let status = BridgeSetup.prepare()
        setupStatus = status
        guard status == .ready else {
            running = false
            return
        }
        start()
    }

    /// Show a plain-language explanation before asking macOS to authenticate
    /// the user's trust-settings change.
    public func requestSecureConnectionSetup() {
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Set up Folio's secure local connection"
        alert.informativeText = "Folio needs one-time permission to trust its encrypted browser connection on this Mac. Documents never leave this Mac. macOS may ask you to authenticate; Folio does not change security settings or require Keychain Access."
        alert.addButton(withTitle: "Set Up Secure Connection")
        alert.addButton(withTitle: "Not Now")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        let status = BridgeSetup.approveTrust()
        setupStatus = status
        if status == .ready {
            start()
        }
    }

    /// Request named Automation consent without touching a document. The
    /// helper repeats this preflight immediately before conversion, so this is
    /// also available as a recovery action when a user previously denied it.
    public func requestAutomationPermission(appName: String) {
        guard appName == "Pages" || appName == "Numbers" else { return }
        NSApp.activate(ignoringOtherApps: true)
        let alert = NSAlert()
        alert.messageText = "Allow Folio to use \(appName)"
        alert.informativeText = "Folio needs permission to ask \(appName) to export this document. The document stays on this Mac. macOS will show its normal Automation prompt next."
        alert.addButton(withTitle: "Continue")
        alert.addButton(withTitle: "Cancel")
        guard alert.runModal() == .alertFirstButtonReturn else { return }

        DispatchQueue.main.async {
            let source = "tell application \"\(appName)\" to get name"
            guard let script = NSAppleScript(source: source) else {
                self.permissionMessage = "macOS could not prepare the \(appName) permission request."
                return
            }
            var error: NSDictionary?
            _ = script.executeAndReturnError(&error)
            if error == nil {
                self.permissionMessage = "\(appName) access is ready."
            } else {
                self.permissionMessage = "macOS did not grant \(appName) access. You can allow Folio under System Settings → Privacy & Security → Automation."
            }
        }
    }

    public func start() {
        guard task == nil || task?.isRunning == false else { return }
        guard let exe = Self.bundledHelperURL(),
              FileManager.default.isExecutableFile(atPath: exe.path) else { return }
        stopping = false
        let p = Process()
        p.executableURL = exe
        p.arguments = []
        p.standardOutput = FileHandle.nullDevice
        p.standardError = FileHandle.nullDevice
        do {
            p.terminationHandler = { [weak self] _ in
                DispatchQueue.main.async {
                    guard let self else { return }
                    self.running = false
                    self.healthy = false
                    self.task = nil
                    guard !self.stopping,
                          self.setupStatus == .ready,
                          self.restartAttempts < 3
                    else { return }
                    self.restartAttempts += 1
                    let work = DispatchWorkItem { [weak self] in
                        self?.start()
                    }
                    self.restartWorkItem = work
                    DispatchQueue.main.asyncAfter(deadline: .now() + 1, execute: work)
                }
            }
            try p.run()
            task = p
            running = true
            healthy = false
            DispatchQueue.main.asyncAfter(deadline: .now() + 10) { [weak self] in
                if self?.running == true { self?.restartAttempts = 0 }
            }
            DispatchQueue.main.asyncAfter(deadline: .now() + 0.4) { [weak self] in
                self?.refreshCapabilities(attempt: 0)
            }
        } catch {
            running = false
        }
    }

    private func refreshCapabilities(attempt: Int) {
        guard running else { return }
        guard let url = URL(string: "https://127.0.0.1:\(FolioMac.helperTLSPort)/v1/capabilities") else { return }
        var request = URLRequest(url: url)
        request.setValue("https://folio.tools", forHTTPHeaderField: "Origin")
        URLSession.shared.dataTask(with: request) { [weak self] data, response, _ in
            guard let http = response as? HTTPURLResponse,
                  http.statusCode == 200,
                  let data,
                  let values = try? JSONSerialization.jsonObject(with: data) as? [String: Any]
            else {
                if attempt < 5 {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { [weak self] in
                        self?.refreshCapabilities(attempt: attempt + 1)
                    }
                }
                return
            }
            var result: [String: Bool] = [:]
            for engine in FolioMac.engines {
                result[engine.id] = values[engine.id] as? Bool ?? false
            }
            DispatchQueue.main.async {
                self?.capabilities = result
                self?.healthy = true
            }
        }.resume()
    }

    public func stop() {
        stopping = true
        restartWorkItem?.cancel()
        restartWorkItem = nil
        let child = task
        task = nil
        if let child, child.isRunning {
            child.terminate()
            // The menu-bar app is about to quit. Wait for the bundled helper
            // to release both loopback listeners so a relaunch cannot race a
            // stale bridge process or inherit its ports.
            child.waitUntilExit()
        }
        running = false
        healthy = false
    }
}

/// User-controlled Open at Login via SMAppService (macOS 13+).
/// State is always read from the system — never assumed.
@available(macOS 13, *)
public enum LoginItem {
    public static var isEnabled: Bool {
        #if canImport(ServiceManagement)
        return SMAppService.mainApp.status == .enabled
        #else
        return false
        #endif
    }

    public static func setEnabled(_ enabled: Bool) throws {
        #if canImport(ServiceManagement)
        if enabled {
            try SMAppService.mainApp.register()
        } else {
            try SMAppService.mainApp.unregister()
        }
        #endif
    }
}
#endif
