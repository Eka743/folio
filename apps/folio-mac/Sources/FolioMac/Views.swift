#if os(macOS) && canImport(SwiftUI)
import SwiftUI
import AppKit

/// macOS application lifecycle delegate.
/// Starts the localhost bridge when Folio for Mac finishes launching and
/// stops it on quit, so the user never touches Terminal. Owning the bridge
/// here makes it available before `applicationDidFinishLaunching` runs.
final class FolioAppDelegate: NSObject, NSApplicationDelegate {
    let bridge = BridgeProcess()

    func applicationDidFinishLaunching(_ notification: Notification) {
        bridge.prepareAndStart()
        if bridge.setupStatus == .needsApproval {
            DispatchQueue.main.async { [weak bridge] in
                bridge?.requestSecureConnectionSetup()
            }
        }
    }

    func applicationWillTerminate(_ notification: Notification) {
        bridge.stop()
    }
}

/// Minimal menu-bar interface. Not a document editor — status, engines,
/// setup guidance, and Quit. Bridge supervision stops the helper on quit.
@available(macOS 13, *)
@main
struct FolioMacApp: App {
    @NSApplicationDelegateAdaptor(FolioAppDelegate.self) private var appDelegate

    var body: some Scene {
        MenuBarExtra("Folio for Mac", systemImage: "doc.on.doc") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(appDelegate.bridge.isReady ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                        .accessibilityHidden(true)
                    Text(appDelegate.bridge.isReady ? "Ready" : "Starting…")
                        .font(.headline)
                }
                .accessibilityLabel(appDelegate.bridge.isReady ? "Folio for Mac ready" : "Folio for Mac starting")

                Divider()

                ForEach(FolioMac.engines, id: \.id) { engine in
                    HStack {
                        Text(engine.label)
                        Spacer()
                        Text(appDelegate.bridge.capabilities[engine.id] == true ? "Installed" : "Not installed")
                            .foregroundStyle(.secondary)
                    }
                    .font(.callout)
                }

                Divider()

                Text("Folio for Mac lets Folio convert supported desktop documents locally. Your files never leave this Mac.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if appDelegate.bridge.setupStatus == .ready {
                    Label("Secure local connection ready", systemImage: "checkmark.seal.fill")
                        .font(.caption)
                        .foregroundStyle(.green)
                } else {
                    Text("Folio needs one-time approval for its encrypted browser connection. macOS handles the approval; Keychain Access and Terminal are not required.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                    Button("Set up secure connection") {
                        appDelegate.bridge.requestSecureConnectionSetup()
                    }
                }

                Divider()

                Text("Pages and Numbers permissions are requested only when a conversion needs them.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                HStack {
                    Button("Set up Pages access") {
                        appDelegate.bridge.requestAutomationPermission(appName: "Pages")
                    }
                    Button("Set up Numbers access") {
                        appDelegate.bridge.requestAutomationPermission(appName: "Numbers")
                    }
                }

                if let permissionMessage = appDelegate.bridge.permissionMessage {
                    Text(permissionMessage)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Toggle("Open Folio automatically when I sign in", isOn: Binding(
                    get: { LoginItem.isEnabled },
                    set: { enabled in
                        try? LoginItem.setEnabled(enabled)
                    }
                ))
                .font(.caption)

                Button("Open Automation Settings") {
                    if let url = URL(string: FolioMac.automationSettingsURL) {
                        NSWorkspace.shared.open(url)
                    }
                }
                .keyboardShortcut("a")

                Button("Quit Folio for Mac") {
                    appDelegate.bridge.stop()
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
            .padding(12)
            .frame(width: 320)
        }
    }

}
#endif
