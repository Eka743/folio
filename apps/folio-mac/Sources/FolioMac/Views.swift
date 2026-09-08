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
        bridge.start()
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
    @State private var capabilities: [String: Bool] = [:]
    @State private var keynoteAutomationStatus: FolioMac.KeynoteAutomationStatus?

    var body: some Scene {
        MenuBarExtra("Folio for Mac", systemImage: "doc.on.doc") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(appDelegate.bridge.running ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                        .accessibilityHidden(true)
                    Text(appDelegate.bridge.running ? "Ready" : "Starting…")
                        .font(.headline)
                }
                .accessibilityLabel(appDelegate.bridge.running ? "Folio for Mac ready" : "Folio for Mac starting")

                Divider()

                ForEach(FolioMac.engines, id: \.id) { engine in
                    HStack {
                        Text(engine.label)
                        Spacer()
                        Text(capabilities[engine.id] == true ? "Installed" : "Not installed")
                            .foregroundStyle(.secondary)
                    }
                    .font(.callout)
                }

                Divider()

                Text("Folio for Mac lets Folio convert desktop documents locally. Your files never leave this Mac.")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Button("Open Loopback Certificate in Keychain Access…") {
                    NSWorkspace.shared.open(FolioMac.bridgeCertificateURL)
                }

                Text("The certificate appears as ‘Folio Loopback Bridge (folio-bridge)’. Open it, expand Trust, choose ‘Always Trust’ for ‘When using this certificate’, then close the dialog and authenticate.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

                Button("Request Keynote Access…") {
                    keynoteAutomationStatus = nil
                    FolioMac.requestKeynoteAutomationPermission { status in
                        keynoteAutomationStatus = status
                    }
                }

                if let keynoteAutomationStatus {
                    Text(keynoteAutomationMessage(keynoteAutomationStatus))
                        .font(.caption2)
                        .foregroundStyle(keynoteAutomationStatus == .granted ? .green : .secondary)
                } else {
                    Text("Folio will ask macOS to authorize Keynote directly. Your files stay on this Mac.")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }

                Text("If macOS previously denied access, use System Settings → Privacy & Security → Automation to change only Folio’s Keynote permission, then relaunch Folio.")
                    .font(.caption2)
                    .foregroundStyle(.secondary)

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

    private func keynoteAutomationMessage(_ status: FolioMac.KeynoteAutomationStatus) -> String {
        switch status {
        case .granted:
            return "Keynote access is granted."
        case .denied:
            return "Keynote access was denied or previously denied. macOS will not prompt again until you change Folio’s Keynote permission in System Settings."
        case .restricted:
            return "Keynote automation is restricted by macOS policy on this Mac."
        case .unavailable:
            return "Keynote is not installed or is unavailable to macOS."
        case .failed:
            return "macOS could not complete the Keynote authorization request. Quit and relaunch Folio, then try once more."
        }
    }
}
#endif
