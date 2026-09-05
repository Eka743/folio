import Foundation

/// Typed conversion errors. `code` is what the HTTP layer returns;
/// `hint` is safe, human-readable guidance (no stack traces, no paths).
public enum ConversionError: Error, Equatable {
    case badRequest(hint: String)
    case forbidden(hint: String)
    case tooLarge
    case appMissing(appName: String)
    case openFailed
    case convertFailed
    case damaged
    case permissionDenied(appName: String)

    public var code: String {
        switch self {
        case .badRequest: return "bad_request"
        case .forbidden: return "forbidden"
        case .tooLarge: return "too_large"
        case .appMissing: return "app_missing"
        case .openFailed: return "open_failed"
        case .convertFailed: return "convert_failed"
        case .damaged: return "damaged"
        case .permissionDenied: return "permission_denied"
        }
    }

    public var hint: String {
        switch self {
        case .badRequest(let h): return h
        case .forbidden(let h): return h
        case .tooLarge: return "This file exceeds the 100 MB local conversion limit."
        case .appMissing(let a): return "\(a) isn't installed on this Mac."
        case .openFailed: return "The desktop app couldn't open this document. It may be damaged or in an unsupported format."
        case .convertFailed: return "The converted file could not be created."
        case .damaged: return "This document appears to be damaged."
        case .permissionDenied(let a): return "macOS denied permission to control \(a). Open System Settings → Privacy & Security → Automation and allow Folio Helper, then try again."
        }
    }
}

public struct ValidatedRequest: Equatable {
    public var from: String
    public var to: String
    public var filename: String
    public init(from: String, to: String, filename: String) {
        self.from = from; self.to = to; self.filename = filename
    }
}

public struct ConvertPayload: Decodable {
    public var from: String?
    public var to: String?
    public var filename: String?
    public var contentBase64: String?
}

/// Validate a POST /v1/convert JSON payload without touching the fs.
/// Throws typed ConversionError with user-safe hints.
public func validateConvertPayload(_ payload: ConvertPayload) throws -> ValidatedRequest {
    guard let rawFrom = payload.from?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines),
          let rawTo = payload.to?.lowercased().trimmingCharacters(in: .whitespacesAndNewlines),
          !rawFrom.isEmpty, !rawTo.isEmpty else {
        throw ConversionError.badRequest(hint: "Missing 'from' or 'to' format.")
    }
    guard HelperSecurity.isAllowedPair(from: rawFrom, to: rawTo) else {
        throw ConversionError.badRequest(hint: "Unsupported conversion '\(rawFrom) → \(rawTo)'.")
    }
    guard let b64 = payload.contentBase64, !b64.isEmpty else {
        throw ConversionError.badRequest(hint: "Missing document content.")
    }
    guard b64.count <= HelperConfig.maxBase64Chars else { throw ConversionError.tooLarge }
    // Extension + MIME-adjacent check: filename extension must agree with `from`.
    let rawName = payload.filename ?? "document"
    let clean = HelperSecurity.sanitizeFilename(rawName)
    let ext = (clean as NSString).pathExtension.lowercased()
    // .pages/.key/.numbers bundles may arrive zipped; accept exact or empty ext.
    if !ext.isEmpty && ext != rawFrom {
        // Allow "jpeg" vs declared image inputs — but convert inputs never
        // include images, so any mismatch here is a bad request.
        throw ConversionError.badRequest(hint: "Filename extension does not match the declared format.")
    }
    return ValidatedRequest(from: rawFrom, to: rawTo, filename: clean)
}

public func outputFilename(for input: String, to: String) -> String {
    let stem = (input as NSString).deletingPathExtension
    return "\(stem.isEmpty ? "folio-output" : stem).\(to)"
}

// MARK: - Native converters

/// Result of a native conversion: output file + engine label for UI transparency.
public protocol NativeConverter {
    var engineName: String { get }
    func convert(input: URL, outputURL: URL, from: String, to: String) throws
}

/// AppleScript source builders. Pure functions — tested without running apps.
/// Paths are POSIX-quoted via HelperSecurity.appleScriptQuoted; no untrusted
/// content is ever interpolated beyond quoted paths + fixed format enums.
public enum AppleScripts {
    public static func pagesExport(inputPath: String, outputPath: String, format: String) -> String {
        let i = HelperSecurity.appleScriptQuoted(inputPath)
        let o = HelperSecurity.appleScriptQuoted(outputPath)
        let kind = format == "pdf" ? "PDF" : "Microsoft Word"
        return """
        tell application "Pages"
          activate
          set srcDoc to open POSIX file "\(i)"
          export srcDoc to POSIX file "\(o)" as \(kind)
          close srcDoc saving no
        end tell
        """
    }

    public static func keynoteExport(inputPath: String, outputPath: String, format: String) -> String {
        let i = HelperSecurity.appleScriptQuoted(inputPath)
        let o = HelperSecurity.appleScriptQuoted(outputPath)
        let kind = format == "pdf" ? "PDF" : "Microsoft PowerPoint"
        return """
        tell application "Keynote"
          activate
          set srcDoc to open POSIX file "\(i)"
          export srcDoc to POSIX file "\(o)" as \(kind)
          close srcDoc saving no
        end tell
        """
    }

    public static func numbersExport(inputPath: String, outputPath: String, format: String) -> String {
        let i = HelperSecurity.appleScriptQuoted(inputPath)
        let o = HelperSecurity.appleScriptQuoted(outputPath)
        let kind = format == "pdf" ? "PDF" : "Microsoft Excel"
        return """
        tell application "Numbers"
          activate
          set srcDoc to open POSIX file "\(i)"
          export srcDoc to POSIX file "\(o)" as \(kind)
          close srcDoc saving no
        end tell
        """
    }

    public static func officeExport(app: String, inputPath: String, outputPath: String) -> String {
        let i = HelperSecurity.appleScriptQuoted(inputPath)
        let o = HelperSecurity.appleScriptQuoted(outputPath)
        // Word/Excel/PowerPoint save-as-PDF via AppleScript `save as`.
        return """
        tell application "\(app)"
          activate
          set srcDoc to open POSIX file "\(i)"
          save as srcDoc file name "\(o)" file format format PDF
          close srcDoc saving no
        end tell
        """
    }
}

#if os(macOS)
/// Runs AppleScript via NSAppleScript (no shell, no GUI clicking, no keystrokes).
/// Kept behind `#if os(macOS)` so the package still builds/tests on Linux CI.
public struct AppleScriptRunner {
    public init() {}
    @discardableResult
    public func run(source: String) throws -> String {
        // NSAppleScript lives in Foundation on macOS.
        guard let script = NSAppleScript(source: source) else {
            throw ConversionError.convertFailed
        }
        var err: NSDictionary?
        let result = script.executeAndReturnError(&err)
        if let err {
            let msg = "\(err)"
            if msg.localizedCaseInsensitiveContains("not authorized") || msg.localizedCaseInsensitiveContains("permission") {
                throw ConversionError.permissionDenied(appName: "the desktop app")
            }
            throw ConversionError.openFailed
        }
        return result.stringValue ?? ""
    }
}
#endif

/// LibreOffice headless fallback (Office formats only, never iWork).
/// Invoked via direct process spawn — no shell, argument array only.
public struct LibreOfficeConverter: NativeConverter {
    public let engineName = "LibreOffice"
    public let sofficePath: String
    public init(sofficePath: String = "/Applications/LibreOffice.app/Contents/MacOS/soffice") {
        self.sofficePath = sofficePath
    }
    public func convert(input: URL, outputURL: URL, from: String, to: String) throws {
        let filter: String
        switch to {
        case "pdf": filter = "writer_pdf_Export"
        default: throw ConversionError.badRequest(hint: "LibreOffice fallback supports PDF output only in v0.2.")
        }
        _ = filter
        let proc = Process()
        proc.executableURL = URL(fileURLWithPath: sofficePath)
        proc.arguments = ["--headless", "--convert-to", "pdf", "--outdir", outputURL.deletingLastPathComponent().path, input.path]
        do {
            try proc.run()
            proc.waitUntilExit()
        } catch {
            throw ConversionError.convertFailed
        }
        guard proc.terminationStatus == 0 else { throw ConversionError.convertFailed }
    }
}

/// Orchestrator: picks native vs fallback, executes, returns engine label.
/// The native `runner` closure is injected so tests run without real apps.
public struct ConversionOrchestrator {
    public var capabilities: HelperCapabilities
    /// (appID, script) -> Void. Production passes AppleScriptRunner; tests pass a mock.
    public var runScript: (String, String) throws -> Void
    public var libreOffice: LibreOfficeConverter?

    public init(capabilities: HelperCapabilities,
                runScript: @escaping (String, String) throws -> Void,
                libreOffice: LibreOfficeConverter? = nil) {
        self.capabilities = capabilities
        self.runScript = runScript
        self.libreOffice = libreOffice
    }

    @discardableResult
    public func convert(input: URL, outputURL: URL, from: String, to: String) throws -> String {
        let selection = selectEngine(from: from, caps: capabilities)
        switch selection {
        case .native(let engine):
            let script: String
            switch engine {
            case "Pages":
                script = AppleScripts.pagesExport(inputPath: input.path, outputPath: outputURL.path, format: to)
            case "Keynote":
                script = AppleScripts.keynoteExport(inputPath: input.path, outputPath: outputURL.path, format: to)
            case "Numbers":
                script = AppleScripts.numbersExport(inputPath: input.path, outputPath: outputURL.path, format: to)
            case "Microsoft Word":
                script = AppleScripts.officeExport(app: "Microsoft Word", inputPath: input.path, outputPath: outputURL.path)
            case "Microsoft PowerPoint":
                script = AppleScripts.officeExport(app: "Microsoft PowerPoint", inputPath: input.path, outputPath: outputURL.path)
            case "Microsoft Excel":
                script = AppleScripts.officeExport(app: "Microsoft Excel", inputPath: input.path, outputPath: outputURL.path)
            default:
                throw ConversionError.badRequest(hint: "Unknown engine.")
            }
            do {
                try runScript(engine, script)
            } catch let e as ConversionError {
                throw e
            } catch {
                throw ConversionError.openFailed
            }
            return engine
        case .libreOffice:
            guard let lo = libreOffice else {
                throw ConversionError.appMissing(appName: "Microsoft Office")
            }
            try lo.convert(input: input, outputURL: outputURL, from: from, to: to)
            return lo.engineName
        case .unavailable(let app):
            throw ConversionError.appMissing(appName: app)
        }
    }
}
