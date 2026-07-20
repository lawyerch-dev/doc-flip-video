## ADDED Requirements

### Requirement: Browseable effect catalog

The system SHALL expose a catalog of atomic effects, transitions, components, and templates with a stable ID, display name, required assets, supported canvases, duration bounds, and capability status.

#### Scenario: Browse an effect before use

- **WHEN** a user opens the effect catalog for a project canvas
- **THEN** the system shows only entries that support that canvas and labels each entry as system, custom-ffmpeg, or unavailable

### Requirement: Components compose registered effects

The system SHALL define reusable components only as registered combinations of allowed effects and transitions.

#### Scenario: Select a component

- **WHEN** a user adds a component to a timeline
- **THEN** the system creates a scene using the component's declared asset slots and defaults without exposing raw FFmpeg parameters

### Requirement: Templates create editable timelines

The system SHALL represent a template as an initial timeline composed from registered components.

#### Scenario: Apply a template

- **WHEN** a user applies a template to a project
- **THEN** the system saves editable scenes to the project timeline and preserves project-local asset references
