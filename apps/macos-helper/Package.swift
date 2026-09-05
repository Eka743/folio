// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "folio-helper",
    platforms: [.macOS(.v13)],
    targets: [
        .executableTarget(
            name: "FolioHelper",
            path: "Sources/FolioHelper"
        ),
        .testTarget(
            name: "FolioHelperTests",
            dependencies: ["FolioHelper"],
            path: "Tests/FolioHelperTests"
        ),
    ]
)
