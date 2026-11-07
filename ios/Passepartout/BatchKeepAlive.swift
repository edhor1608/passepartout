import BackgroundTasks
import Observation
import PassepartoutKit
import UIKit
import os

/// The one place that decides how a running batch gets time from iOS.
///
/// Auto-lock is off while a batch runs, because locking suspends the app. Each run asks for a
/// continued-processing task, which keeps the app running in the background and shows the
/// progress in system UI. If iOS declines, `beginBackgroundTask` buys about 30 s, after which
/// iOS suspends the process and the same runner continues on return. When the task expires in the
/// background, the photo in flight finishes in background time and the rest stays queued until the
/// app is active again. A kill loses the queue; saved photos stay saved.
@MainActor
final class BatchKeepAlive {
  private static let title = "Fotos rahmen"
  /// Info.plist permits `$(PRODUCT_BUNDLE_IDENTIFIER).framing.*`.
  private static let identifierPrefix = "\(Bundle.main.bundleIdentifier ?? "").framing"
  private static let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "", category: "batch")

  private let session: FramingSession
  private var task: BGContinuedProcessingTask?
  /// The submitted request whose task has not launched yet.
  private var awaitedIdentifier: String?
  private var backgroundTime: UIBackgroundTaskIdentifier = .invalid

  /// Follows the session for the app's lifetime, so a scene that iOS disconnects cannot leave
  /// auto-lock off or a finished task open. Observation runs without SwiftUI, so it keeps
  /// following the session while the app is in the background.
  init(session: FramingSession) {
    self.session = session
    Task { await followSession() }
  }

  private func followSession() async {
    let changes = Observations { (self.session.isRunning, self.session.summary) }
    var wasRunning = false
    for await (running, summary) in changes {
      if running != wasRunning {
        if running { holdTime() } else { releaseTime() }
        wasRunning = running
      }
      report(summary)
    }
  }

  /// Asks for time again if iOS took it away while the app was in the background.
  func appBecameActive() {
    guard session.isRunning else { return }
    holdTime()
  }

  private func holdTime() {
    UIApplication.shared.isIdleTimerDisabled = true
    guard task == nil else { return }
    // Covers the wait for the launch, and is all a run gets if iOS declines or never launches it.
    beginBackgroundTime()
    guard awaitedIdentifier == nil else { return }
    let identifier = "\(Self.identifierPrefix).\(UUID().uuidString)"
    let request = BGContinuedProcessingTaskRequest(
      identifier: identifier, title: Self.title, subtitle: session.summary.statusText)
    request.strategy = .fail
    // One identifier per run: registering an identifier twice kills the app.
    let registered = BGTaskScheduler.shared.register(
      forTaskWithIdentifier: identifier, using: .main
    ) { [weak self] task in
      self?.taskStarted(task)
    }
    do {
      guard registered else { throw BGTaskScheduler.Error(.notPermitted) }
      try BGTaskScheduler.shared.submit(request)
      awaitedIdentifier = identifier
      Self.log.info("continued processing submitted: \(identifier, privacy: .public)")
    } catch {
      Self.log.info("continued processing declined: \(error, privacy: .public)")
    }
  }

  private func releaseTime() {
    Self.log.info("batch time released")
    UIApplication.shared.isIdleTimerDisabled = false
    if let awaitedIdentifier {
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: awaitedIdentifier)
      self.awaitedIdentifier = nil
    }
    task?.setTaskCompleted(success: true)
    task = nil
    endBackgroundTime()
  }

  private func taskStarted(_ started: BGTask) {
    guard let started = started as? BGContinuedProcessingTask,
      started.identifier == awaitedIdentifier, session.isRunning
    else {
      started.setTaskCompleted(success: true)
      return
    }
    awaitedIdentifier = nil
    Self.log.info("continued processing started: \(started.identifier, privacy: .public)")
    let identifier = started.identifier
    // iOS does not say which queue runs this; a main-actor closure would trap off the main queue.
    started.expirationHandler = { @Sendable [weak self] in
      Task { @MainActor in self?.taskExpired(identifier) }
    }
    task = started
    report(session.summary)
    endBackgroundTime()
  }

  /// In front, the batch needs no background time yet, so it keeps going and asks again.
  private func taskExpired(_ identifier: String) {
    guard let task, task.identifier == identifier else { return }
    Self.log.info("continued processing expired: \(identifier, privacy: .public)")
    task.setTaskCompleted(success: false)
    self.task = nil
    if UIApplication.shared.applicationState == .active {
      holdTime()
    } else {
      session.pause()
      beginBackgroundTime()
    }
  }

  private func report(_ summary: Summary) {
    guard let task else { return }
    task.progress.totalUnitCount = summary.totalUnits
    task.progress.completedUnitCount = summary.completedUnits
    task.updateTitle(Self.title, subtitle: summary.statusText)
  }

  private func beginBackgroundTime() {
    guard backgroundTime == .invalid else { return }
    backgroundTime = UIApplication.shared.beginBackgroundTask(withName: Self.title) {
      [weak self] in
      self?.endBackgroundTime()
    }
  }

  private func endBackgroundTime() {
    guard backgroundTime != .invalid else { return }
    UIApplication.shared.endBackgroundTask(backgroundTime)
    backgroundTime = .invalid
  }
}
