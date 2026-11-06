import PassepartoutKit
import PhotosUI
import SwiftUI
import UIKit

/// The only screen. Every control shows only when it does something: "Fotos auswählen" always,
/// retry while retryable failures exist, "Einstellungen öffnen" while adds are denied.
struct FramingScreen: View {
  let session: FramingSession
  @State private var picked: [PhotosPickerItem] = []

  var body: some View {
    NavigationStack {
      content
        .navigationTitle("Passepartout")
        .safeAreaInset(edge: .bottom) { actions }
    }
    .onChange(of: picked) { _, items in
      guard !items.isEmpty else { return }
      session.add(items)
      picked = []
    }
  }

  @ViewBuilder private var content: some View {
    if session.photos.isEmpty {
      ContentUnavailableView(
        "Noch keine Fotos",
        systemImage: "photo.on.rectangle",
        description: Text(
          "Gerahmte Kopien landen in deiner Mediathek. Die Originale bleiben unverändert.")
      )
    } else {
      ScrollView {
        VStack(alignment: .leading, spacing: 12) {
          if let blocker = session.blocker { LibraryBlockerBanner(blocker: blocker) }
          StatusLine(summary: session.summary)
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
      if session.summary.retryable > 0, !session.isRunning {
        Button("Erneut versuchen (\(session.summary.retryable))") { session.retryFailed() }
          .buttonStyle(.bordered)
      }
      PhotosPicker(
        selection: $picked,
        maxSelectionCount: nil,
        selectionBehavior: .ordered,
        matching: .images,
        preferredItemEncoding: .current
      ) {
        Label("Fotos auswählen", systemImage: "photo.badge.plus")
      }
      .buttonStyle(.borderedProminent)
    }
    .padding()
  }
}

/// "3 von 12 gespeichert" while photos wait or run, "12 Fotos gespeichert" when done.
private struct StatusLine: View {
  let summary: Summary

  var body: some View {
    Text(text)
      .font(.subheadline)
      .foregroundStyle(.secondary)
  }

  private var text: String {
    if summary.inProgress > 0 { return "\(summary.saved) von \(summary.total) gespeichert" }
    let saved = summary.saved == 1 ? "1 Foto gespeichert" : "\(summary.saved) Fotos gespeichert"
    return summary.failed > 0 ? "\(saved) · \(summary.failed) fehlgeschlagen" : saved
  }
}

/// The framed preview on a grey backdrop, so its white border reads, with the photo's state.
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
