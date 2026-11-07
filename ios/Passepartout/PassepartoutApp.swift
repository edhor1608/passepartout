import PassepartoutKit
import SwiftUI

@main
struct PassepartoutApp: App {
  @State private var session: FramingSession
  @State private var keepAlive: BatchKeepAlive
  @Environment(\.scenePhase) private var scenePhase

  init() {
    SourceFile.removeLeftovers()
    let session = FramingSession()
    _session = State(initialValue: session)
    _keepAlive = State(initialValue: BatchKeepAlive(session: session))
  }

  var body: some Scene {
    WindowGroup {
      FramingScreen(session: session)
        .onChange(of: scenePhase) { _, phase in
          guard phase == .active else { return }
          session.recheckAccess()
          keepAlive.appBecameActive()
        }
    }
  }
}
