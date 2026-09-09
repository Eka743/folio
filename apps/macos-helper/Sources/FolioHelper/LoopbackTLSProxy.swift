#if os(macOS)
import Foundation
import Network
import Security

/// TLS termination for the production browser bridge. Connections are bound
/// to IPv4 loopback, decrypted in process, and streamed to the existing
/// localhost HTTP server so all host/origin/pairing/size checks stay in one
/// code path.
public final class LoopbackTLSProxy {
    private let listener: NWListener
    private let listenPortLabel: UInt16
    private let upstreamPort: NWEndpoint.Port
    private let queue = DispatchQueue(label: "tools.folio.helper.tls")
    private let logger: (String) -> Void

    public init(
        port: UInt16,
        upstreamPort: UInt16,
        identity: sec_identity_t,
        logger: @escaping (String) -> Void
    ) throws {
        guard let listenPort = NWEndpoint.Port(rawValue: port),
              let upstreamPort = NWEndpoint.Port(rawValue: upstreamPort) else {
            throw BridgeTLSError.invalidPort
        }

        let tls = NWProtocolTLS.Options()
        sec_protocol_options_set_local_identity(tls.securityProtocolOptions, identity)
        let tcp = NWProtocolTCP.Options()
        tcp.noDelay = true
        let parameters = NWParameters(tls: tls, tcp: tcp)
        parameters.acceptLocalOnly = true
        parameters.allowLocalEndpointReuse = true
        parameters.requiredLocalEndpoint = .hostPort(
            host: NWEndpoint.Host(HelperConfig.host),
            port: listenPort
        )

        self.listener = try NWListener(using: parameters)
        self.listenPortLabel = port
        self.upstreamPort = upstreamPort
        self.logger = logger
    }

    public func start() {
        listener.stateUpdateHandler = { [logger, listenPortLabel] state in
            switch state {
            case .ready:
                logger("TLS listener ready on 127.0.0.1:\(listenPortLabel)")
            case .failed(let error):
                logger("TLS listener failed: \(error)")
            case .waiting(let error):
                logger("TLS listener waiting: \(error)")
            default:
                break
            }
        }
        listener.newConnectionHandler = { [weak self] client in
            self?.accept(client)
        }
        listener.start(queue: queue)
    }

    private func accept(_ client: NWConnection) {
        let upstream = NWConnection(
            host: NWEndpoint.Host(HelperConfig.host),
            port: upstreamPort,
            using: .tcp
        )
        var connected = false
        upstream.stateUpdateHandler = { [weak self] state in
            guard let self else { return }
            switch state {
            case .ready where !connected:
                connected = true
                self.relay(from: client, to: upstream)
                self.relay(from: upstream, to: client)
            case .failed, .cancelled:
                client.cancel()
            default:
                break
            }
        }
        client.stateUpdateHandler = { state in
            switch state {
            case .failed, .cancelled:
                upstream.cancel()
            default:
                break
            }
        }
        client.start(queue: queue)
        upstream.start(queue: queue)
    }

    private func relay(from source: NWConnection, to destination: NWConnection) {
        source.receive(minimumIncompleteLength: 1, maximumLength: 65_536) {
            [weak self] content, _, isComplete, error in
            guard let self else { return }
            if let error {
                self.logger("TLS relay receive failed: \(error)")
                source.cancel()
                destination.cancel()
                return
            }
            guard let content, !content.isEmpty else {
                if isComplete {
                    destination.send(content: nil, isComplete: true, completion: .contentProcessed { _ in
                        source.cancel()
                        destination.cancel()
                    })
                } else {
                    self.relay(from: source, to: destination)
                }
                return
            }
            destination.send(content: content, isComplete: isComplete, completion: .contentProcessed { error in
                if let error {
                    self.logger("TLS relay send failed: \(error)")
                    source.cancel()
                    destination.cancel()
                } else if isComplete {
                    source.cancel()
                    destination.cancel()
                } else {
                    self.relay(from: source, to: destination)
                }
            })
        }
    }
}
#endif
