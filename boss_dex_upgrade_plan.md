# Boss Dex Visual Upgrade Plan

## Goal
Enhance the visual experience of the Boss Album (Dex) by implementing:
1.  **Holographic 3D Tilt Effect**: Cards tilt and shine based on mouse movement.
2.  **Silhouette Display**: Show silhouettes of undiscovered bosses instead of a generic placeholder.

## Proposed Changes

### `src/features/battle/components/BossAlbumModal.tsx`

#### 1. Implement `useCardTilt` Hook (or inline logic)
-   Track mouse position relative to the card.
-   Calculate `rotateX` and `rotateY` values.
-   Calculate "glare" position.

#### 2. Modify `BossCard` Component
-   **Structure**:
    ```tsx
    <div className="perspective-container">
      <div className="tilt-card" style={{ transform: `rotateX(${x}deg) rotateY(${y}deg)` }}>
        {/* Content */}
        <div className="holographic-overlay" />
      </div>
    </div>
    ```
-   **Holographic Effect**:
    -   Add a gradient overlay that changes opacity/position based on tilt.
    -   Use `mix-blend-mode: overlay` or `color-dodge` for the shiny effect.

#### 3. Update Undiscovered Boss Rendering
-   **Current**: Renders a `div` with `?` icon.
-   **New**:
    -   Render the actual boss image.
    -   Apply CSS filter: `brightness(0) invert(0.2)` (dark silhouette) or similar.
    -   Keep the `?` overlay but make it subtle or centered over the silhouette.
    -   Ensure the image is not clickable or clearly indicates "locked" state.

## Verification
-   **Manual Test**:
    -   Open Boss Album.
    -   Hover over cards to verify 3D tilt and shine effect.
    -   Check undiscovered bosses to see if they appear as silhouettes.
