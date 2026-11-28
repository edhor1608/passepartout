import Observation
import PassepartoutKit
import UIKit

/// Holds plain background time while a collage saves, so a short trip out of the app does not
/// stop the render.
@MainActor
final class SaveKeepAlive {
  private let session: CollageSession
  private var backgroundTime: UIBackgroundTaskIdentifier = .invalid

  init(session: CollageSession) {
    self.session = session
    Task { await followSession() }
  }

  private func followSession() async {
    for await isSaving in Observations({ self.session.phase.isSaving }) {
      if isSaving { begin() } else { end() }
    }
  }

  private func begin() {
    guard backgroundTime == .invalid else { return }
    backgroundTime = UIApplication.shared.beginBackgroundTask(withName: "Collage sichern") {
      [weak self] in
      self?.end()
    }
  }

  private func end() {
    guard backgroundTime != .invalid else { return }
    UIApplication.shared.endBackgroundTask(backgroundTime)
    backgroundTime = .invalid
  }
}
