import BackgroundTasks
import Observation
import PassepartoutKit
import UIKit
import os

@MainActor
final class BatchKeepAlive {
  private enum Grant {
    case awaiting(identifier: String)
    case task(BGContinuedProcessingTask)
    /// iOS refused the task. Plain background time, and a new request on the next activation.
    case declined
    /// A photo still to load cannot load in the background, so the batch stops there once the
    /// app leaves the screen. Plain background time covers the photos up to it, and no system
    /// progress UI promises more. Becomes a task once the rest can load in the background, for
    /// example after the user grants library access.
    case photoInFlightOnly
  }

  private static let title = "Fotos rahmen"
  /// Info.plist permits `$(PRODUCT_BUNDLE_IDENTIFIER).framing.*`.
  private static let identifierPrefix = "\(Bundle.main.bundleIdentifier ?? "").framing"
  private static let log = Logger(subsystem: Bundle.main.bundleIdentifier ?? "", category: "batch")

  private let session: FramingSession
  private var grant: Grant?
  private var backgroundTime: UIBackgroundTaskIdentifier = .invalid

  init(session: FramingSession) {
    self.session = session
    Task { await followSession() }
  }

  private func followSession() async {
    let changes = Observations {
      (
        self.session.isRunning, self.session.isPaused, self.session.summary,
        self.session.canFinishInBackground
      )
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

  func appBecameActive() {
    guard session.isRunning, !session.isPaused else { return }
    switch grant {
    case .declined, .photoInFlightOnly: requestTime()
    case .awaiting: beginBackgroundTime()
    case .task, nil: break
    }
  }

  private func holdTime() {
    UIApplication.shared.isIdleTimerDisabled = true
    switch grant {
    case nil: requestTime()
    // iOS accepts the request only while the app is on screen.
    case .photoInFlightOnly
    where session.canFinishInBackground && UIApplication.shared.applicationState == .active:
      requestTask()
    default: break
    }
  }

  private func requestTime() {
    guard session.canFinishInBackground else {
      grant = .photoInFlightOnly
      beginBackgroundTime()
      return
    }
    requestTask()
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
    case .declined, .photoInFlightOnly, nil: break
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

  /// A stop in system UI expires the task the same way iOS does, with no reason given.
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
