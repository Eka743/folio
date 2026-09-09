// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "folio-mac",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "FolioMac",
            path: "Sources/FolioMac"
        ),
    ]
)
