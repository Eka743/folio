#if os(macOS) && canImport(SwiftUI)
import SwiftUI

/// Minimal menu-bar interface. Not a document editor — status, engines,
/// setup guidance, and Quit. Bridge supervision stops the helper on quit.
@available(macOS 13, *)
@main
struct FolioMacApp: App {
    @StateObject private var bridge = BridgeProcess()
    @State private var capabilities: [String: Bool] = [:]

    var body: some Scene {
        MenuBarExtra("Folio for Mac", systemImage: "doc.on.doc") {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 6) {
                    Circle()
                        .fill(bridge.running ? Color.green : Color.orange)
                        .frame(width: 8, height: 8)
                        .accessibilityHidden(true)
                    Text(bridge.running ? "Ready" : "Starting…")
                        .font(.headline)
                }
                .accessibilityLabel(bridge.running ? "Folio for Mac ready" : "Folio for Mac starting")

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

                Button("Open Automation Settings") {
                    if let url = URL(string: FolioMac.automationSettingsURL) {
                        NSWorkspace.shared.open(url)
                    }
                }
                .keyboardShortcut("a")

                Button("Quit Folio for Mac") {
                    bridge.stop()
                    NSApplication.shared.terminate(nil)
                }
                .keyboardShortcut("q")
            }
            .padding(12)
            .frame(width: 320)
        }
        .onAppear { bridge.start() }
    }
}
#endif
