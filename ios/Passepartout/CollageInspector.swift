import PassepartoutKit
import SwiftUI

/// The spacing, and the shape of what is selected: one photo, or all photos while none is.
struct CollageInspector: View {
  let session: CollageSession
  let document: CollageDocument
  @Binding var selection: CollagePhoto.ID?

  private var selected: (number: Int, photo: CollagePhoto)? {
    guard let index = document.photos.firstIndex(where: { $0.id == selection }) else { return nil }
    return (index + 1, document.photos[index])
  }

  var body: some View {
    VStack(spacing: 4) {
      spacingRow
      shapeRow
    }
    .font(.subheadline)
    .padding(.horizontal, 16)
    .padding(.vertical, 8)
    .background(Color(.secondarySystemGroupedBackground), in: .rect(cornerRadius: 20))
    .padding([.horizontal, .bottom], 12)
  }

  private var spacingRow: some View {
    HStack(spacing: 12) {
      Text("Abstand")
        .accessibilityHidden(true)
      // No `step`: iOS 26 draws a tick for every step, and the binding rounds to whole pixels.
      Slider(
        value: Binding(
          get: { Double(document.spacing.px) },
          set: { px in session.edit { $0.spacing = CollageSpacing(clamping: Int(px.rounded())) } }),
        in: Double(CollageSpacing.range.lowerBound)...Double(CollageSpacing.range.upperBound)
      ) {
        Text("Abstand")
      }
      .accessibilityValue("\(document.spacing.px) Pixel")
      Text("\(CollageSpacing.range.upperBound) px")
        .hidden()
        .overlay(alignment: .trailing) { Text("\(document.spacing.px) px") }
        .monospacedDigit()
        .foregroundStyle(.secondary)
        .accessibilityHidden(true)
    }
    .frame(minHeight: 44)
  }

  private var shapeRow: some View {
    HStack(spacing: 12) {
      scope
      Picker(
        selected.map { "Form von Foto \($0.number)" } ?? "Form aller Fotos",
        selection: Binding(
          get: { document.shape(of: selected?.photo.id) },
          set: { shape in
            guard let shape else { return }
            let id = selected?.photo.id
            withAnimation(.snappy) { session.edit { $0.setShape(shape, of: id) } }
          })
      ) {
        ForEach(CollageShape.allCases, id: \.self) { Text($0.label).tag(CollageShape?.some($0)) }
      }
      .pickerStyle(.segmented)
      if let selected {
        Button("Foto \(selected.number) entfernen", systemImage: "trash", role: .destructive) {
          selection = nil
          withAnimation(.snappy) { session.edit { $0.remove(selected.photo.id) } }
        }
        .labelStyle(.iconOnly)
        .buttonStyle(.bordered)
        .disabled(!document.canRemove)
      }
    }
    .frame(minHeight: 44)
  }

  @ViewBuilder private var scope: some View {
    if let selected {
      Button {
        selection = nil
      } label: {
        HStack(spacing: 4) {
          Text("Foto \(selected.number)")
          Image(systemName: "xmark.circle.fill")
            .foregroundStyle(.secondary)
        }
      }
      .buttonStyle(.plain)
      .foregroundStyle(.tint)
      .fixedSize()
      .accessibilityLabel("Foto \(selected.number), zurück zu allen Fotos")
    } else {
      VStack(alignment: .leading, spacing: 0) {
        Text("Alle Fotos")
        if document.uniformShape == nil {
          Text("Gemischt")
            .font(.caption)
            .foregroundStyle(.secondary)
        }
      }
      .fixedSize()
    }
  }
}

extension CollageShape {
  var label: String {
    switch self {
    case .original: "Original"
    case .square: "Quadrat"
    }
  }
}
