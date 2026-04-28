# Flow Log Floating Chooser Design

## Summary

Replace the current `Flow Step Log` master-detail layout with a log-first viewer that maximizes visible log area. The selected step remains visible in a compact header, while step navigation moves into an on-demand floating chooser instead of a permanently reserved column or drawer.

The goal is to make long synthesis, placement, routing, and DRC logs easier to read without giving up step switching, live-step follow behavior, or "show full log" controls.

## Problem

The current log viewer improved performance substantially, but it still feels visually cramped:

- The persistent step navigation area permanently reduces available width for log text.
- The log body reads like a small sub-panel inside a dashboard card rather than a primary workspace.
- Users who mainly inspect one log at a time pay a constant layout cost for step navigation they are not actively using.
- Dense log content such as ASCII rulers, long command lines, and multiline error traces benefits from more uninterrupted horizontal and vertical space.

This is now primarily a product and readability issue rather than a raw rendering issue.

## Goals

- Maximize the visible area for the currently selected log body.
- Keep step switching fast and discoverable without reserving a permanent left rail.
- Preserve current-step metadata, live-step awareness, and on-demand content loading.
- Keep the current long-term performance direction: one viewer, one selected log body, no bulk expanded DOM.
- Fit within the existing `HomeView` dashboard card instead of turning the log area into a separate full-page route.

## Non-Goals

- Do not reintroduce an always-expanded multi-step stacked log layout.
- Do not turn the log viewer into a terminal emulator.
- Do not add keyboard palette behavior in the first pass.
- Do not redesign the rest of the dashboard around the log panel.

## Chosen Direction

Use a **Floating Chooser** layout:

- The card body is dominated by the log viewer.
- The current step is represented in a compact header row above the viewer.
- A `Steps` button in the header opens a floating chooser anchored to the header area.
- The chooser contains step items with state, tool, live marker, and failure emphasis.
- Selecting a step closes the chooser and swaps the log body.

This direction was chosen because it preserves nearly full-width log reading while keeping step switching less hidden than a command-palette-only approach.

## Information Architecture

### Primary Surface

The primary surface is the currently selected log:

- Current step name
- Tool name
- Status badge
- Log size
- Live indicator or jump-to-live action
- Show-full-log action when truncated
- Readonly CodeMirror body

### Secondary Surface

The step chooser is secondary and transient:

- Hidden by default
- Opened explicitly by the user
- Closed automatically after step selection
- Re-openable at any time from the header

Step navigation should feel like changing tabs in a focused inspector, not like sharing space with the main reading surface.

## Layout

### Card Structure

Inside the existing `Flow Step Log` card:

1. Header row
2. Log body
3. Floating chooser overlay when opened

The card should no longer split horizontally into permanent navigation and viewer areas.

### Header

The header should be compact and single-purpose:

- Left: current step name and tool
- Middle: state badge and optional size
- Right: `Steps`, `Jump to live`, and `Show full log`

The header should not grow into multiple dense rows unless the container becomes very narrow.

### Log Body

The log body should visually read as the dominant surface:

- Full card width below the header
- Minimal decorative framing
- More breathable horizontal padding
- Slightly roomier line height than the current compact version
- Lighter visual weight for line numbers and supporting chrome

### Floating Chooser

The chooser should appear as a popover / floating panel:

- Anchored to the header near the `Steps` trigger
- Wide enough to show step name and tool cleanly
- Tall enough for several visible steps before scrolling
- Clearly above the log body without obscuring the entire card

It should feel like a focused navigator, not like a second main pane.

## Interaction Model

### Default Behavior

- The viewer opens on the default selected step.
- The chooser is closed by default.
- The log body receives the majority of the card height and width.

### Opening the Chooser

- Clicking `Steps` opens the chooser.
- Clicking outside closes it.
- Selecting a step closes it.

### Selecting Steps

- Selecting a step updates the current header and log viewer.
- If the step content has not yet been loaded, the viewer shows a loading state while reading that step on demand.
- User selection remains sticky; live-step updates should not automatically override it.

### Live Step Behavior

- If the currently selected step is the live step, the viewer behaves like the current live log viewer.
- If the user is viewing an older step while a live step exists, show a lightweight `Jump to live` action in the header.
- Do not force automatic switching when the live step changes or grows.

### Truncated Logs

- When the selected step is truncated, `Show full log` remains in the header.
- Expanding the full log only affects the selected step.
- The chooser should not be responsible for expansion actions.

## Data Flow

Reuse the current data architecture:

- `useHomeData()` remains the single source of truth.
- Step metadata is still derived from `flowLogSegments`.
- Step content is still loaded on demand for the selected step.
- Live-step updates continue to update the selected step if it is the live step.

No return to bulk-loading every step body at mount.

## Loading and Empty States

### Initial Load

- If no flow logs exist yet, show the current empty placeholder.
- If step metadata exists but the selected step body is still loading, show a focused loading state in the viewer body.

### Missing Logs

- Missing log files should still render a readable empty/error message in the viewer.
- The header should still reflect the selected step even if the file is unreadable.

### Flow Progress

- If the flow is still running, the header can show a subtle updating indicator.
- This indicator should remain lighter than the log body itself.

## Visual Style

### Reading Comfort

The viewer should feel closer to a dedicated output pane than a small dashboard widget:

- Reduce visual clutter around the log body
- Avoid heavy nested borders
- Prefer subtle separators over boxed compartments
- Increase spacing around text rather than increasing control density

### Status Emphasis

- Failed steps should be strongly identifiable in the chooser.
- Success states should be quieter.
- Live state should be noticeable but not visually dominant.

### Chooser Appearance

- Use a floating panel with elevation and separation from the body
- Keep each step item compact but scannable
- Surface failures and live state with color and iconography

## Accessibility

- The `Steps` trigger must be keyboard focusable.
- The chooser must be dismissible without mouse-only interaction.
- Step items should remain keyboard focusable buttons.
- The current step should be programmatically indicated.
- The log body should remain readable at typical zoom levels without collapsing control layout.

Keyboard shortcuts such as `Esc` to dismiss are good additions, but not mandatory in the first pass.

## Implementation Shape

Expected implementation direction:

- Replace the permanent step list component in `HomeView` with a compact header trigger plus chooser overlay.
- Either adapt `FlowLogStepList.vue` into a floating chooser component or replace it with a narrower chooser-focused component.
- Keep `FlowLogCodeViewer.vue` as the main body viewer.
- Preserve existing selection helpers and on-demand loading behavior.

## Testing

Implementation should verify:

- The source no longer renders a permanent step rail.
- The viewer still supports selected-step switching.
- The chooser open/close state is represented explicitly in component state.
- On-demand loading still occurs when selecting a step whose body is empty.
- Full renderer test suite and typecheck remain green.

## Rollout Notes

This is a focused UI redesign for the existing log card, not a platform-wide layout change. The rest of `HomeView` should remain structurally unchanged while the `Flow Step Log` card becomes more editor-like and reading-first.
