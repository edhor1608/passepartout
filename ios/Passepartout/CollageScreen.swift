import PassepartoutKit
import SwiftUI

struct CollageScreen: View {
  let session: CollageSession

  var body: some View {
    // One branch for the three editor phases keeps the editor's selection across them.
    if let editor = session.phase.editor {
      CollageEditor(session: session, document: editor.document, status: editor.status)
    } else if case .nothingLoaded = session.phase {
      NothingLoaded(retry: session.retryLoading, cancel: session.close)
    } else if case .loading(let load) = session.phase {
      LoadingPhotos(load: load, cancel: session.close)
    }
  }
}

private struct LoadingPhotos: View {
  let load: CollageLoad
  let cancel: () -> Void

  var body: some View {
    VStack(spacing: 16) {
      ProgressView(value: Double(load.finished), total: Double(load.total))
      Text("Fotos laden … \(load.finished) von \(load.total)")
        .font(.subheadline)
        .foregroundStyle(.secondary)
      Button("Abbrechen", action: cancel)
    }
    .padding(32)
  }
}

private struct NothingLoaded: View {
  let retry: () -> Void
  let cancel: () -> Void

  var body: some View {
    ContentUnavailableView {
      Label("Kein Foto geladen", systemImage: "exclamationmark.triangle")
    } description: {
      Text("Die Fotos ließen sich nicht laden. Bist du online?")
    } actions: {
      Button("Erneut versuchen", action: retry)
        .buttonStyle(.borderedProminent)
      Button("Abbrechen", action: cancel)
    }
  }
}

extension CollagePhase {
  var isPicking: Bool {
    if case .picking = self { true } else { false }
  }

  var isSaving: Bool {
    if case .saving = self { true } else { false }
  }

  var coversStartScreen: Bool {
    switch self {
    case .start, .picking: false
    case .loading, .nothingLoaded, .editing, .saving, .saved: true
    }
  }

  fileprivate var editor: (document: CollageDocument, status: CollageEditor.Status)? {
    switch self {
    case .editing(let document, let notice): (document, .editing(notice))
    case .saving(let document): (document, .saving)
    case .saved(let document): (document, .saved)
    case .start, .picking, .loading, .nothingLoaded: nil
    }
  }
}
