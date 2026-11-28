import PassepartoutKit
import SwiftUI
import UIKit

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

  private var selected: CollagePhoto? { document.photos.first { $0.id == selection } }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 20) {
          if case .editing(let notice?) = status { CollageNoticeBanner(notice: notice) }
          CollagePreview(layout: document.layout, selection: $selection)
          controls.disabled(isSaving)
        }
        .padding()
      }
      .navigationTitle("Collage")
      .navigationBarTitleDisplayMode(.inline)
      .safeAreaInset(edge: .bottom) { bottomBar }
    }
  }

  private var controls: some View {
    VStack(alignment: .leading, spacing: 20) {
      Picker("Format", selection: binding(\.canvas) { $0.canvas = $1 }) {
        ForEach(CollageCanvas.allCases, id: \.self) { Text($0.label).tag($0) }
      }
      .pickerStyle(.segmented)

      VStack(alignment: .leading, spacing: 4) {
        LabeledContent("Abstand", value: "\(document.spacing.px) px")
        Slider(
          value: binding({ Double($0.spacing.px) }) { document, px in
            document.spacing = CollageSpacing(clamping: Int(px.rounded()))
          },
          in: Double(CollageSpacing.range.lowerBound)...Double(CollageSpacing.range.upperBound),
          step: 1)
      }

      VStack(alignment: .leading, spacing: 4) {
        LabeledContent("Alle Fotos", value: document.uniformShape == nil ? "Gemischt" : "")
        Picker(
          "Alle Fotos", selection: binding(\.uniformShape) { $0.setShapeOfAll($1 ?? .original) }
        ) {
          ForEach(CollageShape.allCases, id: \.self) { Text($0.label).tag(CollageShape?.some($0)) }
        }
        .pickerStyle(.segmented)
      }

      ThumbnailStrip(photos: document.photos, selection: $selection) { id, index in
        session.edit { $0.move(id, to: index) }
      }

      if let selected { selectedPhotoControls(selected) }
    }
  }

  private func selectedPhotoControls(_ photo: CollagePhoto) -> some View {
    let index = document.photos.firstIndex { $0.id == photo.id } ?? 0
    return VStack(alignment: .leading, spacing: 12) {
      Text("Ausgewähltes Foto").font(.headline)
      Picker("Form", selection: binding({ _ in photo.shape }) { $0.setShape($1, of: photo.id) }) {
        ForEach(CollageShape.allCases, id: \.self) { Text($0.label).tag($0) }
      }
      .pickerStyle(.segmented)
      HStack {
        Button("Nach links", systemImage: "arrow.left") {
          session.edit { $0.move(photo.id, to: index - 1) }
        }
        .labelStyle(.iconOnly)
        .disabled(index == 0)
        Button("Nach rechts", systemImage: "arrow.right") {
          session.edit { $0.move(photo.id, to: index + 1) }
        }
        .labelStyle(.iconOnly)
        .disabled(index == document.photos.count - 1)
        Spacer()
        Button("Entfernen", systemImage: "trash", role: .destructive) {
          session.edit { $0.remove(photo.id) }
        }
        .disabled(!document.canRemove)
      }
      .buttonStyle(.bordered)
      .lineLimit(1)
    }
  }

  private var bottomBar: some View {
    HStack {
      switch status {
      case .saved:
        Label("Gesichert", systemImage: "checkmark.circle.fill")
          .foregroundStyle(.green)
        Spacer()
        Button("Fertig") { session.close() }
          .buttonStyle(.borderedProminent)
      case .editing, .saving:
        Button("Abbrechen") { session.close() }
          .disabled(isSaving)
        Spacer()
        Button {
          session.save()
        } label: {
          if isSaving {
            HStack(spacing: 8) {
              ProgressView()
              Text("Sichert …")
            }
          } else {
            Text("Sichern")
          }
        }
        .buttonStyle(.borderedProminent)
        .disabled(isSaving)
      }
    }
    .padding()
    .background(.bar)
  }

  private func binding<Value>(
    _ read: @escaping (CollageDocument) -> Value,
    write: @escaping (inout CollageDocument, Value) -> Void
  ) -> Binding<Value> {
    Binding(
      get: { read(document) },
      set: { value in session.edit { write(&$0, value) } })
  }
}

private struct CollagePreview: View {
  let layout: CollageLayout
  @Binding var selection: CollagePhoto.ID?

  var body: some View {
    Color.white
      .aspectRatio(CGFloat(layout.canvas.width) / CGFloat(layout.canvas.height), contentMode: .fit)
      .overlay {
        GeometryReader { geometry in
          let scale = geometry.size.width / CGFloat(layout.canvas.width)
          ForEach(layout.cells) { cell in
            let rect = cell.rect
            Image(decorative: cell.photo.preview, scale: 1)
              .resizable()
              .scaledToFill()
              .frame(width: CGFloat(rect.width) * scale, height: CGFloat(rect.height) * scale)
              .clipped()
              .overlay {
                if selection == cell.id { Rectangle().strokeBorder(.tint, lineWidth: 3) }
              }
              .contentShape(.rect)
              .onTapGesture { selection = selection == cell.id ? nil : cell.id }
              .position(
                x: (CGFloat(rect.x) + CGFloat(rect.width) / 2) * scale,
                y: (CGFloat(rect.y) + CGFloat(rect.height) / 2) * scale)
          }
        }
      }
      .padding(12)
      .background(Color(.secondarySystemBackground), in: .rect(cornerRadius: 12))
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Vorschau der Collage")
  }
}

private struct ThumbnailStrip: View {
  let photos: [CollagePhoto]
  @Binding var selection: CollagePhoto.ID?
  let move: (CollagePhoto.ID, Int) -> Void

  var body: some View {
    ScrollView(.horizontal) {
      HStack(spacing: 8) {
        ForEach(Array(photos.enumerated()), id: \.element.id) { index, photo in
          Button {
            selection = selection == photo.id ? nil : photo.id
          } label: {
            thumbnail(photo)
              .overlay {
                if selection == photo.id {
                  RoundedRectangle(cornerRadius: 6).strokeBorder(.tint, lineWidth: 3)
                }
              }
          }
          .buttonStyle(.plain)
          .draggable(String(photo.id)) { thumbnail(photo) }
          .dropDestination(for: String.self) { ids, _ in
            guard let id = ids.first.flatMap({ Int($0) }) else { return false }
            move(id, index)
            return true
          }
          .accessibilityLabel("Foto \(index + 1)")
          .accessibilityAddTraits(selection == photo.id ? .isSelected : [])
        }
      }
      .padding(.vertical, 4)
    }
    .scrollIndicators(.hidden)
  }

  private func thumbnail(_ photo: CollagePhoto) -> some View {
    Image(decorative: photo.preview, scale: 1)
      .resizable()
      .scaledToFill()
      .frame(width: 64, height: 64)
      .clipShape(.rect(cornerRadius: 6))
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

extension CollageCanvas {
  fileprivate var label: String {
    switch self {
    case .portrait3x4: "3:4"
    case .portrait4x5: "4:5"
    case .square: "1:1"
    case .landscape3x2: "3:2"
    }
  }
}

extension CollageShape {
  fileprivate var label: String {
    switch self {
    case .original: "Original"
    case .square: "Quadrat"
    }
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
