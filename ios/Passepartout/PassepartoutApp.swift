import PassepartoutKit
import SwiftUI
import UIKit

@main
struct PassepartoutApp: App {
  @State private var session = FramingSession()
  @State private var keepAlive = BatchKeepAlive()
  @Environment(\.scenePhase) private var scenePhase

  init() {
    SourceFile.removeLeftovers()
  }

  var body: some Scene {
    WindowGroup {
      FramingScreen(session: session)
        .onChange(of: session.isRunning) { _, running in keepAlive.update(running: running) }
        .onChange(of: scenePhase) { _, phase in
          guard phase == .active else { return }
          session.resume()
          keepAlive.update(running: session.isRunning)
        }
    }
  }
}

/// Keeps a running batch going while the user watches it or briefly leaves the app.
///
/// Auto-lock is off while it runs, because locking would background the app. Leaving the app
/// buys the ~30 s that `beginBackgroundTask` grants. When that expires, iOS suspends the process
/// with work in flight and the same runner continues on return. A kill loses the queue; photos
/// already saved stay saved.
final class BatchKeepAlive {
  private var task: UIBackgroundTaskIdentifier = .invalid

  func update(running: Bool) {
    UIApplication.shared.isIdleTimerDisabled = running
    guard running else {
      end()
      return
    }
    guard task == .invalid else { return }
    task = UIApplication.shared.beginBackgroundTask(withName: "Fotos rahmen") { [weak self] in
      self?.end()
    }
  }

  private func end() {
    guard task != .invalid else { return }
    UIApplication.shared.endBackgroundTask(task)
    task = .invalid
  }
}
