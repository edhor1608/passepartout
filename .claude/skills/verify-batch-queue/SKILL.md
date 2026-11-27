---
name: verify-batch-queue
description: Model-checks the iOS batch queue (FramingSession, BatchKeepAlive) with TLA+. Use before committing a change to FramingSession.swift, BatchKeepAlive.swift, PassepartoutApp.swift or the session calls in FramingScreen.swift, when ios/formal/check.sh fails, or to ask whether a pause, a continued-processing task or background time can go wrong.
---

# Verify the batch queue

`ios/formal/BatchQueue.tla` models every order in which FramingSession and BatchKeepAlive can run against the scene phase, the user's taps, Photos and BGTaskScheduler. `ios/formal/check.sh` model-checks it with TLC. A pass covers the model within its bounds, not the app.

**Sync commit: `78f8f6f`.** The model was last confirmed to describe the covered code at this commit.

## Properties

Each property is one TLA+ definition at the end of `BatchQueue.tla`.

| Property                      | Promise                                                                                                                                      | Harm when broken                                   |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `PauseHolds`                  | A task expiry that arrives while the runner runs pauses the batch. No photo starts loading until Fortsetzen, Erneut versuchen or a new pick. | A stop in system UI does not hold.                 |
| `StopHolds`                   | The same for every task expiry, also one that arrives after the runner ended or after `releaseTime()` completed the task.                    | Same.                                              |
| `ReleasedWhenIdle`            | Once the batch stopped and `followSession()` saw it, no request awaits launch, iOS runs no task, background time ended.                      | A grant leaks; a later batch gets no task or time. |
| `BackgroundTimeWhileAwaiting` | A running batch in the background with an unlaunched request holds background time.                                                          | iOS suspends the app before the task launches.     |
| `LastReportComplete`          | The last progress a held task gets before `releaseTime()` completes it counts every finished photo.                                          | System UI ends one photo short.                    |
| `ForegroundLoadsInForeground` | No picker handover is in flight while the app is in the background.                                                                          | RunningBoard kills the app (`0x2182BAAD`).         |
| `RetryableKept`               | A new pick keeps the failures a retry can fix.                                                                                               | Retryable failures vanish with their button.       |

## Coverage

One TLA+ action per stretch of main-actor code between two awaits, plus one per iOS or user event. Each action's comment names its Swift function.

- `FramingSession.swift`: `add`, `retryFailed`, `updateQueuedSources`, `resume`, `pause`, `appBecameActive`, `appMovedToBackground`, `continueQueue`, `drain`, `process`, `load` with `Handover` and `foregroundLoad`, `watch` (stall timeout as a failed load, moving progress as `LoadProgresses`), `canFinishInBackground`, `summary`.
- `BatchKeepAlive.swift`: `followSession`, `appBecameActive`, `holdTime`, `requestTime`, `requestTask`, `releaseTime`, `taskStarted`, `taskExpired`, `report`, `beginBackgroundTime`, `endBackgroundTime`.
- `PassepartoutApp.swift`: the `scenePhase` handler.
- `FramingScreen.swift`: the picker's `onChange` (`add`), Fortsetzen (`resume`, shown while paused), Erneut versuchen (`retryFailed`, shown while not paused, not running and with retryable failures), `accessChanged` (`updateQueuedSources`).

A change touches the model when it adds or moves an `await`, changes a guard or the order of statements in a covered function, writes `photos`, `isPaused`, `runner`, `grant` or `backgroundTime` from new code, or adds a caller of a covered function. Formatting, comments, log lines and UI text do not. List the candidates with:

```bash
git diff 78f8f6f -- ios/PassepartoutKit/Sources/PassepartoutKit/FramingSession.swift ios/Passepartout/BatchKeepAlive.swift ios/Passepartout/PassepartoutApp.swift ios/Passepartout/FramingScreen.swift
```

## Run

```bash
make -C ios formal               # every run, about 2 min of CPU; needs Java 11+ and curl
ios/formal/check.sh <run>        # one run, with its counterexample
```

The script downloads `tla2tools.jar` v1.7.4 once into `~/.cache/tla2tools`, pinned by sha256. Each line of output is one run:

- `current` checks the code as it is against every property except the known findings in `KNOWN_FINDINGS`, and must hold. There are none today.
- Every other run sets the `Bug` constant to re-enable one fixed defect and must break the property that guards it: `ExpiryKeepsRunning` (b7392d6), `ActivationLiftsPause` (61c4a18), `AwaitingUnheld` and `AwaitingNeverCleared` (e660a2a), `ReportAfterRelease` (8cb42e4), `ForegroundLoadInBackground` (70e6b9a), `AddDropsRetryable` (b4d191a), `PauseNeedsRunner` (d7f437d) and `ReleasedStopDropped` (78f8f6f), both found by this model.

A counterexample prints one line per step: the action and the variables it changed.

## Change the model with the code

1. Find the action whose comment names the changed function and mirror the change there: a new guard becomes a new condition, a new `await` splits the action in two, a new caller becomes a new action. Write it from the Swift code, before you run the check.
2. Run `make -C ios formal`.
3. Judge each failing line as in the next section.
4. Once the model describes the code at your commit, set the sync commit above to that commit, in the same change.

## Read a failure

- **`current` fails.** Replay the counterexample against the Swift code, step by step. If every step can happen in the app, the code breaks the property: report the steps in Swift terms and the harm, and leave the property as it is. If a step cannot happen, the model is wrong: fix the action, and say what was wrong.
- **A bug run says `keeps`.** The model no longer re-enables that defect, usually because an action changed under its `Bug` branch. Rewrite the branch so it does again.
- **A known finding's run says `holds now`.** The finding is fixed. Turn its run into a `Bug` replay of the old code and drop the property from `KNOWN_FINDINGS` in `check.sh`.
- **TLC reports a parse error or a state that is "not completely specified".** The model is wrong: every action must assign every variable.

## Bounds and assumptions

- Two picks of one photo each (`MaxAdds = 2`) and three accepted task requests (`MaxRequests = 3`): 1,346,965 states.
- Framing and saving are one step, since only progress units tell them apart. Unreadable and too-small photos count as saved.
- The scene phase and `applicationState` change together. Activation can also follow an inactive phase in front.
- iOS accepts a task request only while the app is on screen. It may launch a request late or never, and may expire a running task at any time.
- `requestAddAccess` may answer either way on every call.
- A pick, Fortsetzen or Erneut versuchen while an expiry is still on its way to the main actor overrides that stop. The model then allows the batch to run; the app may still pause it, which errs toward holding the stop.
- Out of scope: background time running out, suspension and kills by iOS, the photo pipeline in `PhotoFramer.swift`, `PhotosBridge.swift`, and the in-flight fraction in progress reports.
