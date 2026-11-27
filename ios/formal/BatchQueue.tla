------------------------------ MODULE BatchQueue ------------------------------
(***************************************************************************)
(* The iOS batch queue: FramingSession (PassepartoutKit/.../FramingSession.  *)
(* swift) and BatchKeepAlive (Passepartout/BatchKeepAlive.swift), driven by *)
(* the scene phase (PassepartoutApp.swift), the buttons in FramingScreen.   *)
(* swift, Photos and BGTaskScheduler. Both classes are @MainActor, so each  *)
(* app action is the code between two awaits. Bug re-enables a fixed defect.*)
(***************************************************************************)
EXTENDS Naturals, Sequences, FiniteSets

CONSTANTS MaxAdds, MaxRequests, Bug

ASSUME Bug \in {"none", "ExpiryKeepsRunning", "ActivationLiftsPause", "AwaitingUnheld",
                "AwaitingNeverCleared", "ReportAfterRelease", "ForegroundLoadInBackground",
                "AddDropsRetryable", "PauseNeedsRunner", "ReleasedStopDropped"}

VARIABLES
  photos,          \* FramingSession.photos; fg: the source cannot load in the background
  isPaused,        \* FramingSession.isPaused
  blocker,         \* FramingSession.blocker != nil
  inBg,            \* FramingSession.isInBackground, and applicationState != .active
  runner,          \* where FramingSession.drain() awaits; "none" while runner == nil
  handover,        \* the Handover of the load in flight
  grant,           \* BatchKeepAlive.grant
  bgTime,          \* BatchKeepAlive.backgroundTime != .invalid
  obsPending,      \* a change the Observations in followSession() has not delivered yet
  reported,        \* finished photos in the last report() to the held task
  nextId,          \* identifier of the next BGContinuedProcessingTaskRequest
  submitted,       \* submitted requests iOS has not launched or cancelled
  launching,       \* launched tasks whose handler has not run on the main queue yet
  running,         \* tasks iOS runs that were neither completed nor expired
  expiring,        \* expired tasks whose taskExpired(_:) has not run yet
  added,           \* picks so far, bounded by MaxAdds
  readAccessAsked, \* ReadAccessOffer answered; it shows once while undetermined
  overridden,      \* history: expiries on their way when the user picked, resumed or retried
  stop,            \* history: a task expiry the user has not overridden; "running" if it
                   \* came while the runner ran, "idle" if after it ended, "late" if
                   \* releaseTime() had completed the task first
  shortReport      \* history: a held task completed with a stale last report

session == <<photos, isPaused, blocker, inBg, runner, handover>>
vars == <<photos, isPaused, blocker, inBg, runner, handover, grant, bgTime, obsPending,
          reported, nextId, submitted, launching, running, expiring, added, readAccessAsked,
          stop, overridden, shortReport>>

NoGrant == [kind |-> "none", id |-> 0]
Grant(kind, id) == [kind |-> kind, id |-> id]

Idx(st) == {i \in DOMAIN photos : photos[i].st = st}
InFlight == CHOOSE i \in DOMAIN photos : photos[i].st \in {"loading", "processing"}
IsRunning == runner # "none"
Finished == Cardinality(Idx("saved") \cup Idx("retry"))
InProgress == Len(photos) - Finished
CanFinishInBackground ==
  ~\E i \in DOMAIN photos : photos[i].st \in {"queued", "loading"} /\ photos[i].fg
IsRetryable(photo) == photo.st = "retry"
WithState(i, st) == [photos EXCEPT ![i].st = st]

\* Observations fires on every write to photos and on every change of isPaused or isRunning.
Tracked == <<photos, isPaused, IsRunning>>
Notify == obsPending' = (obsPending \/ Tracked' # Tracked)
\* A write of an equal value notifies for photos, which is not Equatable, and may notify for
\* isPaused, depending on the @Observable macro's equality check.
NotifyOnWrite == obsPending' \in IF Tracked' # Tracked THEN {TRUE} ELSE {obsPending, TRUE}

\* A user call (add, retryFailed, resume) lifts the pause, then FramingSession.continueQueue()
\* runs with photos set to p. Activate and GrantReadAccess reach it only while not paused, which
\* is the guard continueQueue() itself has.
ContinueQueue(p) ==
  /\ photos' = p
  /\ isPaused' = FALSE
  /\ runner' = IF runner = "none" /\ \E i \in DOMAIN p : p[i].st = "queued"
               THEN "access" ELSE runner

\* The head of the while loop in FramingSession.drain(), with photos set to p
DrainLoop(p) ==
  LET queued == {i \in DOMAIN p : p[i].st = "queued"}
      next == CHOOSE i \in queued : \A j \in queued : i <= j
  IN  IF queued = {} THEN
        /\ photos' = p /\ isPaused' = FALSE /\ runner' = "none" /\ handover' = "none"
      ELSE IF isPaused \/ (Bug # "ForegroundLoadInBackground" /\ inBg /\ p[next].fg) THEN
        /\ photos' = p /\ runner' = "none" /\ handover' = "none" /\ UNCHANGED isPaused
      ELSE
        /\ photos' = [p EXCEPT ![next].st = "loading"]
        /\ runner' = "loading" /\ handover' = "pending" /\ UNCHANGED isPaused

\* BatchKeepAlive.requestTask(). iOS accepts a request only while the app is on screen.
RequestTask(onScreen) ==
  \E accepted \in IF onScreen /\ nextId <= MaxRequests THEN BOOLEAN ELSE {FALSE} :
    IF accepted THEN
      /\ grant' = Grant("awaiting", nextId)
      /\ submitted' = submitted \cup {nextId}
      /\ nextId' = nextId + 1
      \* e660a2a: background time began only when iOS declined
      /\ bgTime' = (Bug # "AwaitingUnheld" \/ bgTime)
    ELSE
      /\ grant' = Grant("declined", 0)
      /\ bgTime' = TRUE
      /\ UNCHANGED <<submitted, nextId>>

\* BatchKeepAlive.requestTime()
RequestTime(onScreen) ==
  IF CanFinishInBackground THEN RequestTask(onScreen)
  ELSE /\ grant' = Grant("photoInFlightOnly", 0)
       /\ bgTime' = TRUE
       /\ UNCHANGED <<submitted, nextId>>

\* BatchKeepAlive.holdTime()
HoldTime ==
  CASE grant.kind = "none" -> RequestTime(~inBg)
    [] grant.kind = "photoInFlightOnly" /\ CanFinishInBackground /\ ~inBg -> RequestTask(TRUE)
    [] OTHER -> UNCHANGED <<grant, bgTime, submitted, nextId>>

\* BatchKeepAlive.releaseTime(); lastReport is what report() last gave the held task
ReleaseTime(lastReport) ==
  IF Bug = "AwaitingNeverCleared" /\ grant.kind = "awaiting" THEN
    \* e660a2a: the end of a batch neither cancelled nor forgot the awaited request
    /\ bgTime' = FALSE
    /\ UNCHANGED <<grant, submitted, running, shortReport, overridden>>
  ELSE
    /\ grant' = NoGrant
    /\ bgTime' = FALSE
    /\ submitted' = IF grant.kind = "awaiting" THEN submitted \ {grant.id} ELSE submitted
    /\ running' = IF grant.kind = "task" THEN running \ {grant.id} ELSE running
    /\ shortReport' = (shortReport \/ (grant.kind = "task" /\ lastReport # Finished))
    /\ UNCHANGED overridden

\* One pass of the for-await loop in BatchKeepAlive.followSession()
Observe ==
  /\ obsPending
  /\ obsPending' = FALSE
  /\ IF ~IsRunning THEN
       \* 8cb42e4: report() ran after releaseTime(), when no task was held any more
       LET lastReport == IF grant.kind = "task" /\ Bug # "ReportAfterRelease"
                         THEN Finished ELSE reported
       IN  /\ ReleaseTime(lastReport)
           /\ reported' = lastReport
           /\ UNCHANGED nextId
     ELSE
       /\ IF ~isPaused THEN HoldTime ELSE UNCHANGED <<grant, bgTime, submitted, nextId>>
       /\ reported' = IF grant.kind = "task" THEN Finished ELSE reported
       /\ UNCHANGED <<running, shortReport, overridden>>
  /\ UNCHANGED <<session, launching, expiring, added, readAccessAsked, stop>>

\* iOS launches a submitted request, or never does
TaskLaunches ==
  \E id \in submitted :
    /\ submitted' = submitted \ {id}
    /\ launching' = launching \cup {id}
    /\ UNCHANGED <<session, grant, bgTime, reported, nextId, running, expiring, added,
                   readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* BatchKeepAlive.taskStarted(_:), the launch handler registered on the main queue
TaskStarted ==
  \E id \in launching :
    /\ launching' = launching \ {id}
    /\ IF grant = Grant("awaiting", id) /\ IsRunning THEN
         /\ grant' = Grant("task", id)
         /\ running' = running \cup {id}
         /\ reported' = Finished
         /\ bgTime' = FALSE
       ELSE UNCHANGED <<grant, running, reported, bgTime>>
    /\ UNCHANGED <<session, nextId, submitted, expiring, added, readAccessAsked, stop, overridden,
                   shortReport>>
  /\ Notify

\* iOS ends the task, or the user stops it in system UI. The expirationHandler queues
\* taskExpired(_:) on the main actor.
TaskExpires ==
  \E id \in running :
    /\ running' = running \ {id}
    /\ expiring' = expiring \cup {id}
    /\ UNCHANGED <<session, grant, bgTime, reported, nextId, submitted, launching, added,
                   readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* BatchKeepAlive.taskExpired(_:), which calls FramingSession.pause()
TaskExpired ==
  \E id \in expiring :
    /\ expiring' = expiring \ {id}
    /\ IF grant = Grant("task", id) THEN
         /\ stop' = IF id \in overridden THEN stop ELSE IF IsRunning THEN "running" ELSE "idle"
         /\ IF Bug = "ExpiryKeepsRunning" /\ ~inBg THEN
              \* b7392d6: on screen, expiry asked for a new task and did not pause
              /\ RequestTime(TRUE)
              /\ UNCHANGED isPaused
            ELSE
              /\ grant' = NoGrant
              /\ isPaused' = (isPaused \/ IsRunning \/
                              (Bug # "PauseNeedsRunner" /\ \E i \in DOMAIN photos : photos[i].st = "queued"))
              /\ bgTime' = TRUE
              /\ UNCHANGED <<submitted, nextId>>
       ELSE
         \* the expiry landed after releaseTime() completed the task
         /\ stop' = IF id \in overridden THEN stop ELSE "late"
         /\ isPaused' = IF Bug = "ReleasedStopDropped" THEN isPaused
                        ELSE isPaused \/ IsRunning \/ \E i \in DOMAIN photos : photos[i].st = "queued"
         /\ UNCHANGED <<grant, bgTime, submitted, nextId>>
    /\ overridden' = overridden \ {id}
    /\ UNCHANGED <<photos, blocker, inBg, runner, handover, reported, launching, running,
                   added, readAccessAsked, shortReport>>
  /\ Notify

\* drain(): `blocker = await library.requestAddAccess()` returns
AccessAnswered ==
  /\ runner = "access"
  /\ \E refused \in BOOLEAN :
       /\ blocker' = refused
       /\ IF refused THEN runner' = "none" /\ UNCHANGED <<photos, isPaused, handover>>
          ELSE DrainLoop(photos)
  /\ UNCHANGED <<inBg, grant, bgTime, reported, nextId, submitted, launching, running,
                 expiring, added, readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* The Handover finishes: loadOriginal's completion, or watch() giving up on a stalled transfer
LoadEnds ==
  /\ handover = "pending"
  /\ handover' \in {"ok", "failed"}
  /\ UNCHANGED <<photos, isPaused, blocker, inBg, runner, grant, bgTime, reported, nextId,
                 submitted, launching, running, expiring, added, readAccessAsked, stop, overridden,
                 shortReport>>
  /\ Notify

\* watch() -> showLoading(): a moving transfer changes the summary
LoadProgresses ==
  /\ handover = "pending"
  /\ ~obsPending
  /\ obsPending' = TRUE
  /\ UNCHANGED <<session, grant, bgTime, reported, nextId, submitted, launching, running,
                 expiring, added, readAccessAsked, stop, overridden, shortReport>>

\* load() resumes after the Handover finished, then process() and drain() go on
LoadResumes ==
  /\ runner = "loading"
  /\ handover \in {"ok", "failed", "background"}
  /\ CASE handover = "ok" ->
            /\ photos' = WithState(InFlight, "processing")
            /\ runner' = "processing"
            /\ handover' = "none"
            /\ UNCHANGED isPaused
       [] handover = "failed" -> DrainLoop(WithState(InFlight, "retry"))
       [] handover = "background" -> DrainLoop(WithState(InFlight, "queued"))
  /\ UNCHANGED <<blocker, inBg, grant, bgTime, reported, nextId, submitted, launching, running,
                 expiring, added, readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* process(): framePhoto and library.add return, the photo is saved or failed, drain() goes on
ProcessEnds ==
  /\ runner = "processing"
  /\ \E outcome \in {"saved", "retry"} : DrainLoop(WithState(InFlight, outcome))
  /\ UNCHANGED <<blocker, inBg, grant, bgTime, reported, nextId, submitted, launching, running,
                 expiring, added, readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* "Fotos auswählen": the PhotosPicker in FramingScreen -> FramingSession.add(_:)
Add ==
  /\ ~inBg
  /\ added < MaxAdds
  /\ \E fg \in BOOLEAN :
       LET kept == IF InProgress > 0 THEN photos
                   \* b4d191a: a new batch cleared every photo
                   ELSE IF Bug = "AddDropsRetryable" THEN << >>
                   ELSE SelectSeq(photos, IsRetryable)
       IN  ContinueQueue(Append(kept, [id |-> added + 1, st |-> "queued", fg |-> fg]))
  /\ added' = added + 1
  /\ stop' = "none"
  /\ overridden' = expiring
  /\ UNCHANGED <<blocker, inBg, handover, grant, bgTime, reported, nextId, submitted, launching,
                 running, expiring, readAccessAsked, shortReport>>
  /\ Notify

\* "Fortsetzen" -> FramingSession.resume()
Resume ==
  /\ ~inBg
  /\ isPaused
  /\ ContinueQueue(photos)
  /\ stop' = "none"
  /\ overridden' = expiring
  /\ UNCHANGED <<blocker, inBg, handover, grant, bgTime, reported, nextId, submitted, launching,
                 running, expiring, added, readAccessAsked, shortReport>>
  /\ Notify

\* "Erneut versuchen" -> FramingSession.retryFailed()
RetryFailed ==
  /\ ~inBg
  /\ ~isPaused
  /\ ~IsRunning
  /\ Idx("retry") # {}
  /\ ContinueQueue([i \in DOMAIN photos |->
                      IF photos[i].st = "retry" THEN [photos[i] EXCEPT !.st = "queued"]
                      ELSE photos[i]])
  /\ stop' = "none"
  /\ overridden' = expiring
  /\ UNCHANGED <<blocker, inBg, handover, grant, bgTime, reported, nextId, submitted, launching,
                 running, expiring, added, readAccessAsked, shortReport>>
  /\ Notify

\* "Zugriff erlauben" -> FramingScreen.accessChanged(to:) ->
\* FramingSession.updateQueuedSources(LibraryPhoto.preferred)
GrantReadAccess ==
  /\ ~inBg
  /\ ~readAccessAsked
  /\ readAccessAsked' = TRUE
  /\ \E swapped \in SUBSET {i \in Idx("queued") : photos[i].fg} :
       LET p == [i \in DOMAIN photos |->
                   IF i \in swapped THEN [photos[i] EXCEPT !.fg = FALSE] ELSE photos[i]]
       IN  IF isPaused THEN photos' = p /\ UNCHANGED <<isPaused, runner>>
           ELSE ContinueQueue(p)
  /\ UNCHANGED <<blocker, inBg, handover, grant, bgTime, reported, nextId, submitted, launching,
                 running, expiring, added, stop, overridden, shortReport>>
  /\ NotifyOnWrite

\* scenePhase .background -> FramingSession.appMovedToBackground()
MoveToBackground ==
  /\ ~inBg
  /\ inBg' = TRUE
  \* 70e6b9a: before it, a picker handover in flight kept running in the background
  /\ handover' = IF /\ Bug # "ForegroundLoadInBackground"
                    /\ runner = "loading" /\ handover = "pending" /\ photos[InFlight].fg
                 THEN "background" ELSE handover
  /\ UNCHANGED <<photos, isPaused, blocker, runner, grant, bgTime, reported, nextId, submitted,
                 launching, running, expiring, added, readAccessAsked, stop, overridden, shortReport>>
  /\ Notify

\* Whether FramingSession.appBecameActive() reaches continueQueue()
ActivationContinues ==
  CASE Bug = "ExpiryKeepsRunning" -> TRUE   \* b7392d6: activation called resume()
    [] Bug = "ActivationLiftsPause" -> ~isPaused \/ blocker   \* 61c4a18
    [] OTHER -> ~isPaused

\* scenePhase .active -> FramingSession.appBecameActive(), then BatchKeepAlive.appBecameActive().
\* Also fires in front, after the app was only inactive.
Activate ==
  /\ inBg' = FALSE
  /\ IF ActivationContinues THEN ContinueQueue(photos) ELSE UNCHANGED <<photos, isPaused, runner>>
  /\ IF runner' # "none" /\ ~isPaused' THEN
       CASE grant.kind \in {"declined", "photoInFlightOnly"} -> RequestTime(TRUE)
         [] grant.kind = "awaiting" /\ Bug # "AwaitingUnheld" ->
              bgTime' = TRUE /\ UNCHANGED <<grant, submitted, nextId>>
         [] OTHER -> UNCHANGED <<grant, bgTime, submitted, nextId>>
     ELSE UNCHANGED <<grant, bgTime, submitted, nextId>>
  /\ UNCHANGED <<blocker, handover, reported, launching, running, expiring, added,
                 readAccessAsked, stop, overridden, shortReport>>
  /\ IF ActivationContinues THEN NotifyOnWrite ELSE Notify

Init ==
  /\ photos = << >>
  /\ isPaused = FALSE
  /\ blocker = FALSE
  /\ inBg = FALSE
  /\ runner = "none"
  /\ handover = "none"
  /\ grant = NoGrant
  /\ bgTime = FALSE
  /\ obsPending = FALSE
  /\ reported = 0
  /\ nextId = 1
  /\ submitted = {}
  /\ launching = {}
  /\ running = {}
  /\ expiring = {}
  /\ added = 0
  /\ readAccessAsked = FALSE
  /\ overridden = {}
  /\ stop = "none"
  /\ shortReport = FALSE

Next ==
  \/ Add \/ Resume \/ RetryFailed \/ GrantReadAccess \/ MoveToBackground \/ Activate
  \/ AccessAnswered \/ LoadEnds \/ LoadProgresses \/ LoadResumes \/ ProcessEnds
  \/ Observe \/ TaskLaunches \/ TaskStarted \/ TaskExpires \/ TaskExpired

Spec == Init /\ [][Next]_vars

TypeOK ==
  /\ \A i \in DOMAIN photos :
       photos[i].st \in {"queued", "loading", "processing", "saved", "retry"}
  /\ runner \in {"none", "access", "loading", "processing"}
  /\ handover \in {"none", "pending", "ok", "failed", "background"}
  /\ grant.kind \in {"none", "awaiting", "task", "declined", "photoInFlightOnly"}
  /\ Cardinality(Idx("loading") \cup Idx("processing"))
       = IF runner \in {"loading", "processing"} THEN 1 ELSE 0
  /\ (runner = "loading") = (Idx("loading") # {})
  /\ (handover # "none") = (runner = "loading")
  /\ grant.kind = "task" => grant.id \in running \cup expiring
  /\ InProgress = 0 => ~IsRunning
  /\ stop \in {"none", "running", "idle", "late"}
  /\ overridden \subseteq 1..MaxRequests

(***************************************************************************)
(* Properties. Each holds for Bug = "none". check.sh shows that each       *)
(* fixed defect breaks its property.                                        *)
(***************************************************************************)

\* A stop in system UI holds: after taskExpired(_:) no photo starts loading until the user
\* taps Fortsetzen or Erneut versuchen or picks photos.
LoadStarts == handover # "pending" /\ handover' = "pending"
StopHolds == [][stop # "none" => ~LoadStarts]_vars

\* StopHolds for a stop that arrives while FramingSession.runner is set.
PauseHolds == [][stop = "running" => ~LoadStarts]_vars

\* Once a batch stopped and followSession() saw it, nothing holds the app: no request awaits
\* its launch, iOS runs no task for the app, and background time has ended.
ReleasedWhenIdle == (~IsRunning /\ ~obsPending) => (grant = NoGrant /\ ~bgTime /\ running = {})

\* A batch running in the background while its request has not launched holds background time.
BackgroundTimeWhileAwaiting == (IsRunning /\ inBg /\ grant.kind = "awaiting") => bgTime

\* The last progress a held task gets before releaseTime() completes it counts every finished
\* photo.
LastReportComplete == ~shortReport

\* No picker handover is in flight while the app is in the background.
ForegroundLoadsInForeground == (inBg /\ handover = "pending") => ~photos[InFlight].fg

\* A new pick keeps the failures a retry can fix.
RetryableKept ==
  [][\A i \in Idx("retry") : \E j \in DOMAIN photos' : photos'[j].id = photos[i].id]_vars
=============================================================================
