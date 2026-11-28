import PassepartoutKit
import SwiftUI

/// The format choice and the collage. A photo dragged onto another one takes its place.
struct CollageStage: View {
  let session: CollageSession
  let document: CollageDocument
  @Binding var selection: CollagePhoto.ID?
  @Environment(\.accessibilityReduceMotion) private var reduceMotion

  var body: some View {
    VStack(spacing: 4) {
      FormatBar(chosen: document.canvas) { format in
        withAnimation(.snappy) { session.edit { $0.canvas = format } }
      }
      CollageCanvasView(layout: document.layout, selection: $selection) { id, index in
        session.edit { $0.move(id, to: index) }
      }
      // The free height goes below the paper, so the bar stays put when the format changes.
      .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .top)
      // Every edit reflows the collage here, also a drop, whose reset transaction cannot read
      // the environment. The lifted photo still follows the finger, which no animation drives.
      .transaction { if reduceMotion { $0.animation = nil } }
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
  /// Stays above the others while it flies to its place or back. Photos at rest never overlap,
  /// so nothing resets it.
  @State private var lastLifted: CollagePhoto.ID?
  @Environment(\.isEnabled) private var isEnabled

  private struct Drag: Equatable {
    let id: CollagePhoto.ID
    let translation: CGSize
    /// The place in the order the photo takes when dropped now, `nil` beside the paper.
    let target: Int?
  }

  private static let space = "collage"

  /// The photo whose place the lifted one takes when dropped now.
  private var target: CollageLayout.Cell? {
    guard let drag, let index = drag.target, layout.cells.indices.contains(index) else {
      return nil
    }
    let cell = layout.cells[index]
    return cell.id == drag.id ? nil : cell
  }

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
          // Its own layer, because the lifted photo covers the photo below it.
          if let target {
            let frame = target.rect.scaled(by: scale)
            Rectangle()
              .fill(.tint.opacity(0.3))
              .strokeBorder(.tint, lineWidth: 3)
              .frame(width: frame.width, height: frame.height)
              .position(x: frame.midX, y: frame.midY)
              .zIndex(2)
              .allowsHitTesting(false)
          }
        }
      }
      .coordinateSpace(.named(Self.space))
      // Set on lift, so a drop, a drag let go beside the paper and one iOS cancels all keep it on top.
      .onChange(of: drag?.id) { _, id in if let id { lastLifted = id } }
      // `disabled` alone is only documented to lock controls, and photos are no controls.
      .allowsHitTesting(isEnabled)
      .sensoryFeedback(.selection, trigger: drag?.target)
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Vorschau der Collage")
  }

  private func photo(_ cell: CollageLayout.Cell, at index: Int, scale: CGFloat) -> some View {
    let frame = cell.rect.scaled(by: scale)
    let isDragged = drag?.id == cell.id
    let isSelected = selection == cell.id
    return Image(decorative: cell.photo.preview, scale: 1)
      .resizable()
      .scaledToFill()
      .frame(width: frame.width, height: frame.height)
      .clipped()
      .overlay {
        if isSelected { Rectangle().strokeBorder(.tint, lineWidth: 3) }
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
      .opacity(isDragged ? 0.85 : 1)
      .animation(.snappy, value: isDragged)
      // Below the animation, so the photo follows the finger without a delay.
      .offset(isDragged ? drag?.translation ?? .zero : .zero)
      .onTapGesture { selection = isSelected ? nil : cell.id }
      .gesture(dragging(cell, scale: scale))
      .position(x: frame.midX, y: frame.midY)
      .zIndex(isDragged || lastLifted == cell.id ? 1 : 0)
  }

  private func dragging(_ cell: CollageLayout.Cell, scale: CGFloat) -> some Gesture {
    func target(_ value: DragGesture.Value) -> Int? {
      layout.dropIndex(x: value.location.x / scale, y: value.location.y / scale)
    }
    return DragGesture(minimumDistance: 8, coordinateSpace: .named(Self.space))
      .updating($drag) { value, drag, _ in
        drag = Drag(id: cell.id, translation: value.translation, target: target(value))
      }
      .onEnded { value in
        guard let index = target(value) else { return }
        withAnimation(.snappy) { move(cell.id, index) }
      }
  }
}

extension PixelRect {
  fileprivate func scaled(by scale: CGFloat) -> CGRect {
    CGRect(
      x: CGFloat(x) * scale, y: CGFloat(y) * scale,
      width: CGFloat(width) * scale, height: CGFloat(height) * scale)
  }
}
