# Boss Dex Visual Upgrades Walkthrough

I have implemented the requested visual upgrades for the Boss Dex (Album).

## Changes

### 1. Holographic 3D Tilt Effect
-   **Component**: `BossCard` in `src/features/battle/components/BossAlbumModal.tsx`
-   **Feature**:
    -   Cards now react to mouse movement with a 3D tilt effect (`rotateX`, `rotateY`).
    -   A "glare" and "shine" effect moves across the card based on the mouse position, simulating a holographic surface.
    -   The effect is applied only to **discovered** bosses.
    -   Uses `perspective-1000` and `transform-style: preserve-3d` for realistic depth.

### 2. Undiscovered Boss Silhouettes
-   **Component**: `BossCard`
-   **Feature**:
    -   Instead of a generic placeholder, undiscovered bosses now show their actual image.
    -   The image is heavily filtered: `grayscale`, `blur`, and `brightness(0) invert(0.3)` to create a dark, mysterious silhouette.
    -   A "LOCKED" overlay with a question mark is displayed on top.
    -   This provides a hint of what the boss looks like without fully revealing it, encouraging collection.

## Verification Results

### Manual Verification Steps
1.  **Open Boss Album**: Click the "Boss Dex" button in the Battle tab.
2.  **Check Discovered Bosses**:
    -   Hover over a card of a defeated boss.
    -   **Expected**: The card should tilt in 3D towards the mouse cursor. A shiny glare should follow the cursor.
3.  **Check Undiscovered Bosses**:
    -   Look at a card for a boss that hasn't been defeated yet.
    -   **Expected**: You should see a dark silhouette of the boss instead of a blank card. It should have a "LOCKED" label. Hovering should NOT trigger the 3D tilt effect.

## Visual Reference

(Since I cannot capture screenshots directly, please verify visually in the app)

-   **Discovered**: 3D Tilt + Holographic Shine
-   **Undiscovered**: Dark Silhouette + Locked Icon
