import PassepartoutKit
import SwiftUI

/// The format choice and the collage. A photo dragged onto another one takes its place.
struct CollageStage: View {
  let session: CollageSession
  let document: CollageDocument
  @Binding var selection: CollagePhoto.ID?

  var body: some View {
    VStack(spacing: 4) {
      FormatBar(chosen: document.canvas) { format in
        withAnimation(.snappy) { session.edit { $0.canvas = format } }
      }
      CollageCanvasView(layout: document.layout, selection: $selection) { id, index in
        session.edit { $0.move(id, to: index) }
      }
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
    .padding([.horizontal, .bottom], 12)
    .contentShape(.rect)
    .onTapGesture { selection = nil }
  }
}

private struct FormatBar: View {
  let chosen: CollageCanvas
  let choose: (CollageCanvas) -> Void
  @Environment(\.isEnabled) private var isEnabled

  var body: some View {
    HStack(spacing: 4) {
      ForEach(CollageCanvas.allCases, id: \.self) { format in
        let isChosen = format == chosen
        Button {
          choose(format)
        } label: {
          HStack(spacing: 6) {
            FormatGlyph(format: format)
            Text(format.label)
          }
          .font(.subheadline.weight(.medium))
          .foregroundStyle(isChosen ? AnyShapeStyle(.tint) : AnyShapeStyle(.secondary))
          .padding(.horizontal, 12)
          .frame(height: 32)
          .background(
            isChosen ? AnyShapeStyle(.tint.opacity(0.15)) : AnyShapeStyle(.clear), in: .capsule
          )
          .frame(minHeight: 44)
          .contentShape(.rect)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(format.spokenName)
        .accessibilityAddTraits(isChosen ? .isSelected : [])
      }
    }
    .opacity(isEnabled ? 1 : 0.4)
    .accessibilityElement(children: .contain)
    .accessibilityLabel("Format")
  }
}

/// The outline of a canvas, every format drawn with the same area.
private struct FormatGlyph: View {
  let format: CollageCanvas

  var body: some View {
    let size = format.size
    let stretch = (CGFloat(size.width) / CGFloat(size.height)).squareRoot()
    RoundedRectangle(cornerRadius: 2)
      .strokeBorder(lineWidth: 1.5)
      .frame(width: 16 * stretch, height: 16 / stretch)
  }
}

private struct CollageCanvasView: View {
  let layout: CollageLayout
  @Binding var selection: CollagePhoto.ID?
  let move: (CollagePhoto.ID, Int) -> Void
  /// Resets itself when iOS cancels the gesture, so no photo stays lifted.
  @GestureState(resetTransaction: Transaction(animation: .snappy)) private var drag: Drag? = nil
  /// The dropped photo, which stays above the others until it reached its place.
  @State private var settling: CollagePhoto.ID?
  @Environment(\.isEnabled) private var isEnabled

  private struct Drag: Equatable {
    let id: CollagePhoto.ID
    let translation: CGSize
    /// The place in the order the photo takes when dropped now.
    let target: Int
  }

  private static let space = "collage"

  var body: some View {
    Color.white
      .shadow(color: .black.opacity(0.12), radius: 6, y: 2)
      .aspectRatio(CGFloat(layout.canvas.width) / CGFloat(layout.canvas.height), contentMode: .fit)
      .overlay {
        GeometryReader { geometry in
          let scale = geometry.size.width / CGFloat(layout.canvas.width)
          ForEach(Array(layout.cells.enumerated()), id: \.element.id) { index, cell in
            photo(cell, at: index, scale: scale)
          }
        }
      }
      .coordinateSpace(.named(Self.space))
      // `disabled` alone is only documented to lock controls, and photos are no controls.
      .allowsHitTesting(isEnabled)
      .sensoryFeedback(.selection, trigger: drag?.target)
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Vorschau der Collage")
  }

  private func photo(_ cell: CollageLayout.Cell, at index: Int, scale: CGFloat) -> some View {
    let rect = cell.rect
    let isDragged = drag?.id == cell.id
    let isTarget = drag.map { $0.target == index && $0.id != cell.id } ?? false
    let isSelected = selection == cell.id
    return Image(decorative: cell.photo.preview, scale: 1)
      .resizable()
      .scaledToFill()
      .frame(width: CGFloat(rect.width) * scale, height: CGFloat(rect.height) * scale)
      .clipped()
      .overlay {
        if isTarget { Color.accentColor.opacity(0.3) }
        if isTarget || isSelected { Rectangle().strokeBorder(.tint, lineWidth: 3) }
      }
      .contentShape(.rect)
      .accessibilityElement()
      .accessibilityLabel("Foto \(index + 1) von \(layout.cells.count)")
      .accessibilityValue(cell.photo.shape.label)
      .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
      .accessibilityAction { selection = isSelected ? nil : cell.id }
      .accessibilityActions {
        if index > 0 {
          Button("Nach vorne") { withAnimation(.snappy) { move(cell.id, index - 1) } }
        }
        if index < layout.cells.count - 1 {
          Button("Nach hinten") { withAnimation(.snappy) { move(cell.id, index + 1) } }
        }
      }
      .scaleEffect(isDragged ? 1.05 : 1)
      .shadow(color: .black.opacity(isDragged ? 0.35 : 0), radius: 12, y: 6)
      .animation(.snappy, value: isDragged)
      // Below the animation, so the photo follows the finger without a delay.
      .offset(isDragged ? drag?.translation ?? .zero : .zero)
      .onTapGesture { selection = isSelected ? nil : cell.id }
      .gesture(dragging(cell, scale: scale))
      .position(
        x: (CGFloat(rect.x) + CGFloat(rect.width) / 2) * scale,
        y: (CGFloat(rect.y) + CGFloat(rect.height) / 2) * scale
      )
      .zIndex(isDragged || settling == cell.id ? 1 : 0)
  }

  private func dragging(_ cell: CollageLayout.Cell, scale: CGFloat) -> some Gesture {
    func target(_ value: DragGesture.Value) -> Int {
      layout.dropIndex(x: value.location.x / scale, y: value.location.y / scale)
    }
    return DragGesture(minimumDistance: 8, coordinateSpace: .named(Self.space))
      .updating($drag) { value, drag, _ in
        drag = Drag(id: cell.id, translation: value.translation, target: target(value))
      }
      .onEnded { value in
        settling = cell.id
        withAnimation(.snappy) {
          move(cell.id, target(value))
        } completion: {
          settling = nil
        }
      }
  }
}

extension CollageCanvas {
  fileprivate var label: String {
    switch self {
    case .portrait3x4: "3:4"
    case .square: "1:1"
    case .landscape3x2: "3:2"
    }
  }

  fileprivate var spokenName: String {
    switch self {
    case .portrait3x4: "Hochformat 3 zu 4"
    case .square: "Quadrat 1 zu 1"
    case .landscape3x2: "Querformat 3 zu 2"
    }
  }
}
