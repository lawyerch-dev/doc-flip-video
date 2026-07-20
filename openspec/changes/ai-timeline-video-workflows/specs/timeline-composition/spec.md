## ADDED Requirements

### Requirement: Versioned linear timeline

The system SHALL persist project compositions as a versioned linear timeline with ordered visual scenes and at most one background audio track.

#### Scenario: Reorder scenes

- **WHEN** a user saves a timeline with visual scenes in a new order
- **THEN** the next preview and export render scenes in that saved order

### Requirement: Component-based scenes

Each visual scene SHALL reference a registered component ID, registered project asset IDs, and a duration within that component's allowed range.

#### Scenario: Validate a scene before saving

- **WHEN** a timeline contains an unknown component, missing required asset, or invalid duration
- **THEN** the system rejects the timeline and identifies the invalid scene

### Requirement: Safe effect compilation

The renderer SHALL compile timelines from the component registry and SHALL NOT execute FFmpeg expressions, paths, or filter arguments supplied by a user or AI response.

#### Scenario: Render a validated timeline

- **WHEN** a saved timeline contains only valid components, assets, transitions, and durations
- **THEN** the renderer compiles the timeline into FFmpeg input and filter arguments and writes the result inside the project's output directory

### Requirement: Capability-aware transition fallback

The renderer SHALL use a registered fallback transition when a selected transition is unavailable for the detected FFmpeg capability, and SHALL reject a transition with no fallback.

#### Scenario: Export without custom FFmpeg

- **WHEN** a timeline selects a custom-FFmpeg transition that has a system FFmpeg fallback and `build/ffmpeg-custom` is absent
- **THEN** the export uses the fallback transition and records the effective transition in build metadata
