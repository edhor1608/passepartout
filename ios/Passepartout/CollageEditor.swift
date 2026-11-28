import PassepartoutKit
import SwiftUI

/// One screen without scrolling: the stage takes the height the bar and the inspector leave.
struct CollageEditor: View {
  enum Status {
    case editing(CollageNotice?)
    case saving
    case saved
  }

  let session: CollageSession
  let document: CollageDocument
  let status: Status
  @State private var selection: CollagePhoto.ID?

  private var isSaving: Bool {
    if case .saving = status { true } else { false }
  }

  var body: some View {
    NavigationStack {
      VStack(spacing: 0) {
        if case .editing(let notice?) = status {
          CollageNoticeBanner(notice: notice)
            .fixedSize(horizontal: false, vertical: true)
            .padding([.horizontal, .bottom], 12)
        }
        CollageStage(session: session, document: document, selection: $selection)
        CollageInspector(session: session, document: document, selection: $selection)
      }
      .disabled(isSaving)
      // The screen cannot scroll, so text stops growing where the stage would get too small.
      .dynamicTypeSize(...DynamicTypeSize.accessibility1)
      .background(Color(.systemGroupedBackground))
      .navigationTitle("Collage")
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .principal) { title }
        if case .saved = status {
          ToolbarItem(placement: .confirmationAction) {
            Button("Fertig") { session.close() }
          }
        } else {
          ToolbarItem(placement: .cancellationAction) {
            Button("Abbrechen") { session.close() }
              .disabled(isSaving)
          }
          ToolbarItem(placement: .confirmationAction) {
            Button("Sichern") { session.save() }
              .disabled(isSaving)
          }
        }
      }
    }
  }

  @ViewBuilder private var title: some View {
    switch status {
    case .editing:
      Text("Collage")
        .font(.headline)
    case .saving:
      HStack(spacing: 8) {
        ProgressView()
        Text("Sichert …")
      }
      .font(.headline)
    case .saved:
      Label("Gesichert", systemImage: "checkmark.circle.fill")
        .labelStyle(.titleAndIcon)
        .font(.headline)
        .foregroundStyle(.green)
    }
  }
}

private struct CollageNoticeBanner: View {
  let notice: CollageNotice

  var body: some View {
    switch notice {
    case .libraryBlocked(let blocker): LibraryBlockerBanner(blocker: blocker)
    case .photosDropped(let count):
      banner(
        count == 1
          ? "1 Foto ließ sich nicht laden und fehlt in der Collage."
          : "\(count) Fotos ließen sich nicht laden und fehlen in der Collage.")
    case .notSaved(let failure): banner(failure.collageMessage)
    }
  }

  private func banner(_ text: String) -> some View {
    Text(text)
      .font(.subheadline)
      .frame(maxWidth: .infinity, alignment: .leading)
      .padding()
      .background(.yellow.opacity(0.15), in: .rect(cornerRadius: 12))
  }
}

extension PhotoFailure {
  fileprivate var collageMessage: String {
    switch self {
    case .notSaved: "Die Mediathek hat die Collage nicht angenommen."
    case .storageFull: "Der iPhone-Speicher ist voll."
    case .unreadable: "Ein Original ist nicht mehr lesbar. Wähle die Fotos neu aus."
    case .renderFailed, .notLoaded, .tooSmall:
      "Die Collage ließ sich nicht erstellen. Versuche es noch einmal."
    }
  }
}
