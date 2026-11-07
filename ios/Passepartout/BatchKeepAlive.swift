import BackgroundTasks
import Observation
import PassepartoutKit
import UIKit
import os

/// The one place that decides how a running batch gets time from iOS.
///
/// Auto-lock is off while a batch runs, because locking suspends the app. Each run asks for a
/// continued-processing task, which keeps the app running in the background and shows the
/// progress in system UI. Background time from `beginBackgroundTask` holds the app until the task
/// launches. If iOS declines the task, that background time lasts about 30 s, after which iOS
/// suspends the process and the same runner continues on return. When the task expires, the photo
/// in flight finishes and the batch stays paused until the user continues it in the app. A kill
/// loses the queue; saved photos stay saved.
@MainActor
final class BatchKeepAlive {
  /// What holds the running batch. `nil` while no batch runs or after its task expired.
  private enum Grant {
    /// Submitted, not launched yet. Background time holds the app meanwhile.
    case awaiting(identifier: String)
    case task(BGContinuedProcessingTask)
    /// Only background time, until iOS suspends the app.
    case declined
  }

  private static let title = "Fotos rahmen"
  /// Info.plist permits `$(PRODUCT_BUNDLE_IDENTIFIER).framing.*`.
  private static let identifierPrefix = "\(Bundle.main.bundleIdentifier ?? "").framing"
  private static let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "", category: "batch")

  private let session: FramingSession
  private var grant: Grant?
  private var backgroundTime: UIBackgroundTaskIdentifier = .invalid

  /// Follows the session for the app's lifetime, so a scene that iOS disconnects cannot leave
  /// auto-lock off or a finished task open. Observation runs without SwiftUI, so it keeps
  /// following the session while the app is in the background.
  init(session: FramingSession) {
    self.session = session
    Task { await followSession() }
  }

  /// Each change only triggers a look at the session as it is now. A value that arrives late
  /// could otherwise ask for a new task right after one expired.
  private func followSession() async {
    let changes = Observations {
      (self.session.isRunning, self.session.isPaused, self.session.summary)
    }
    for await _ in changes {
      report(session.summary)
      if !session.isRunning {
        releaseTime()
      } else if !session.isPaused {
        holdTime()
      }
    }
  }

  /// Asks iOS again if it declined the task, and renews the background time that waits for a
  /// task that has not launched yet.
  func appBecameActive() {
    guard session.isRunning, !session.isPaused else { return }
    switch grant {
    case .declined: requestTask()
    case .awaiting: beginBackgroundTime()
    case .task, nil: break
    }
  }

  private func holdTime() {
    UIApplication.shared.isIdleTimerDisabled = true
    if grant == nil { requestTask() }
  }

  private func requestTask() {
    beginBackgroundTime()
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
      grant = .awaiting(identifier: identifier)
      Self.log.info("continued processing submitted: \(identifier, privacy: .public)")
    } catch {
      grant = .declined
      Self.log.info("continued processing declined: \(error, privacy: .public)")
    }
  }

  private func releaseTime() {
    UIApplication.shared.isIdleTimerDisabled = false
    switch grant {
    case .awaiting(let identifier):
      BGTaskScheduler.shared.cancel(taskRequestWithIdentifier: identifier)
    case .task(let task): task.setTaskCompleted(success: true)
    case .declined, nil: break
    }
    if grant != nil { Self.log.info("batch time released") }
    grant = nil
    endBackgroundTime()
  }

  private func taskStarted(_ started: BGTask) {
    guard let started = started as? BGContinuedProcessingTask,
      case .awaiting(started.identifier)? = grant, session.isRunning
    else {
      started.setTaskCompleted(success: true)
      return
    }
    Self.log.info("continued processing started: \(started.identifier, privacy: .public)")
    let identifier = started.identifier
    // iOS does not say which queue runs this; a main-actor closure would trap off the main queue.
    started.expirationHandler = { @Sendable [weak self] in
      Task { @MainActor in self?.taskExpired(identifier) }
    }
    grant = .task(started)
    report(session.summary)
    endBackgroundTime()
  }

  /// A stop in system UI expires the task the same way iOS does, with no reason given. So the
  /// batch pauses either way, and only the user continues it, which asks for a new task.
  private func taskExpired(_ identifier: String) {
    guard case .task(let task)? = grant, task.identifier == identifier else { return }
    Self.log.info("continued processing expired: \(identifier, privacy: .public)")
    task.setTaskCompleted(success: false)
    grant = nil
    session.pause()
    beginBackgroundTime()
  }

  private func report(_ summary: Summary) {
    guard case .task(let task)? = grant else { return }
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
