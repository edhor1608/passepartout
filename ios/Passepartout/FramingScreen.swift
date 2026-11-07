import PassepartoutKit
import Photos
import PhotosUI
import SwiftUI
import UIKit

struct FramingScreen: View {
  let session: FramingSession
  @State private var picked: [PhotosPickerItem] = []
  @State private var readAccess = PHPhotoLibrary.authorizationStatus(for: .readWrite)
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    NavigationStack {
      content
        .navigationTitle("Passepartout")
        .safeAreaInset(edge: .bottom) { actions }
    }
    .onChange(of: picked) { _, items in
      guard !items.isEmpty else { return }
      session.add(LibraryPhoto.preferred(items))
      picked = []
    }
    .onChange(of: scenePhase) { _, phase in
      if phase == .active { readAccess = PHPhotoLibrary.authorizationStatus(for: .readWrite) }
    }
  }

  /// Changing photo access in Settings makes iOS kill the app, so Settings is offered only
  /// while no batch would get lost with it.
  private var offersReadAccess: Bool {
    switch readAccess {
    case .notDetermined: true
    case .denied, .limited: session.summary.inProgress == 0
    case .authorized, .restricted: false
    @unknown default: false
    }
  }

  private func accessChanged(to status: PHAuthorizationStatus) {
    readAccess = status
    session.updateQueuedSources(LibraryPhoto.preferred)
  }

  @ViewBuilder private var content: some View {
    if session.photos.isEmpty {
      VStack {
        ContentUnavailableView(
          "Noch keine Fotos",
          systemImage: "photo.on.rectangle",
          description: Text(
            "Gerahmte Kopien landen in deiner Mediathek. Die Originale bleiben unverändert.")
        )
        if offersReadAccess {
          ReadAccessOffer(status: readAccess, onChange: accessChanged).padding()
        }
      }
    } else {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          if let blocker = session.blocker { LibraryBlockerBanner(blocker: blocker) }
          if offersReadAccess { ReadAccessOffer(status: readAccess, onChange: accessChanged) }
          StatusLine(summary: session.summary, isPaused: session.isPaused)
          LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 8), count: 3)) {
            ForEach(session.photos) { PhotoTile(photo: $0) }
          }
        }
        .padding()
      }
    }
  }

  private var actions: some View {
    HStack {
      if session.isPaused {
        Button("Fortsetzen") { session.resume() }
          .buttonStyle(.bordered)
      } else if session.summary.retryable > 0, !session.isRunning {
        Button("Erneut versuchen (\(session.summary.retryable))") { session.retryFailed() }
          .buttonStyle(.bordered)
      }
      PhotosPicker(
        selection: $picked,
        maxSelectionCount: nil,
        selectionBehavior: .ordered,
        matching: .images,
        preferredItemEncoding: .current,
        photoLibrary: .shared()
      ) {
        Label("Fotos auswählen", systemImage: "photo.badge.plus")
      }
      .buttonStyle(.borderedProminent)
    }
    .padding()
  }
}

private struct StatusLine: View {
  let summary: Summary
  let isPaused: Bool

  var body: some View {
    Text(isPaused ? "Pausiert · \(summary.statusText)" : summary.statusText)
      .font(.subheadline)
      .foregroundStyle(.secondary)
  }
}

extension Summary {
  var statusText: String {
    if inProgress > 0 { return "\(saved) von \(total) gespeichert" }
    let savedText = saved == 1 ? "1 Foto gespeichert" : "\(saved) Fotos gespeichert"
    return failed > 0 ? "\(savedText) · \(failed) fehlgeschlagen" : savedText
  }
}

private struct PhotoTile: View {
  let photo: Photo

  var body: some View {
    Color(.secondarySystemBackground)
      .aspectRatio(1, contentMode: .fit)
      .overlay {
        if let preview = photo.state.preview {
          Image(decorative: preview, scale: 1)
            .resizable()
            .scaledToFit()
            .padding(6)
        }
      }
      .overlay(alignment: .bottomLeading) { badge.padding(6) }
      .clipShape(.rect(cornerRadius: 8))
  }

  @ViewBuilder private var badge: some View {
    switch photo.state {
    case .queued: Text("Wartet").font(.caption2).foregroundStyle(.secondary)
    case .loading(let fraction?):
      progress("Lädt … \(fraction.formatted(.percent.precision(.fractionLength(0))))")
    case .loading(nil): progress("Lädt …")
    case .framing: progress("Rahmt …")
    case .saving: progress("Speichert …")
    case .saved:
      Image(systemName: "checkmark.circle.fill")
        .foregroundStyle(.white, .green)
        .accessibilityLabel("Gespeichert")
    case .failed(let failure):
      Label(failure.message, systemImage: "exclamationmark.triangle.fill")
        .font(.caption2)
        .foregroundStyle(.red)
    }
  }

  private func progress(_ title: String) -> some View {
    HStack(spacing: 4) {
      ProgressView().controlSize(.mini)
      Text(title).font(.caption2).foregroundStyle(.secondary)
    }
  }
}

private struct LibraryBlockerBanner: View {
  let blocker: LibraryBlocker
  @Environment(\.openURL) private var openURL

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      switch blocker {
      case .denied:
        Text("Passepartout darf keine Fotos hinzufügen. Erlaube es in den Einstellungen.")
        Button("Einstellungen öffnen") {
          if let settings = URL(string: UIApplication.openSettingsURLString) { openURL(settings) }
        }
      case .restricted:
        Text("Fotos hinzufügen ist auf diesem iPhone eingeschränkt.")
      }
    }
    .font(.subheadline)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(.yellow.opacity(0.15), in: .rect(cornerRadius: 12))
  }
}

/// Read access lets a batch go on after the user leaves the app.
private struct ReadAccessOffer: View {
  let status: PHAuthorizationStatus
  let onChange: (PHAuthorizationStatus) -> Void
  @Environment(\.openURL) private var openURL

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("Weiterrahmen, wenn du die App verlässt").bold()
      Text(
        status == .limited
          ? "Das klappt nur mit Fotos, die Passepartout sehen darf. Erlaube den Zugriff auf alle Fotos."
          : "Dafür braucht Passepartout Zugriff auf deine Fotos. Ohne lädt die App Fotos nur, solange sie offen ist."
      )
      if status == .notDetermined {
        Button("Zugriff erlauben") {
          Task { onChange(await PHPhotoLibrary.requestAuthorization(for: .readWrite)) }
        }
      } else {
        Button("Einstellungen öffnen") {
          if let settings = URL(string: UIApplication.openSettingsURLString) { openURL(settings) }
        }
      }
    }
    .font(.subheadline)
    .frame(maxWidth: .infinity, alignment: .leading)
    .padding()
    .background(.blue.opacity(0.1), in: .rect(cornerRadius: 12))
  }
}

extension PhotoFailure {
  fileprivate var message: String {
    switch self {
    case .notLoaded: "Laden fehlgeschlagen, bist du online?"
    case .storageFull: "iPhone-Speicher ist voll."
    case .unreadable: "Dieses Format wird nicht unterstützt."
    case .tooSmall: "Zu klein für den Rand."
    case .renderFailed: "Rahmen fehlgeschlagen."
    case .notSaved: "Speichern fehlgeschlagen."
    }
  }
}
