import PassepartoutKit
import SwiftUI

@main
struct PassepartoutApp: App {
  @State private var session: FramingSession
  @State private var keepAlive: BatchKeepAlive
  @State private var collage: CollageSession
  @State private var saveKeepAlive: SaveKeepAlive
  @Environment(\.scenePhase) private var scenePhase

  init() {
    SourceFile.removeLeftovers()
    let session = FramingSession()
    _session = State(initialValue: session)
    _keepAlive = State(initialValue: BatchKeepAlive(session: session))
    let collage = CollageSession()
    _collage = State(initialValue: collage)
    _saveKeepAlive = State(initialValue: SaveKeepAlive(session: collage))
  }

  var body: some Scene {
    WindowGroup {
      FramingScreen(session: session, collage: collage)
        .onChange(of: scenePhase) { _, phase in
          switch phase {
          case .active:
            session.appBecameActive()
            keepAlive.appBecameActive()
            collage.appBecameActive()
          case .background:
            session.appMovedToBackground()
            collage.appMovedToBackground()
          default: break
          }
        }
    }
  }
}
