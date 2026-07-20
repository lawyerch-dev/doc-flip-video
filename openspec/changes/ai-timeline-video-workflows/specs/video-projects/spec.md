## ADDED Requirements

### Requirement: Isolated video projects

The system SHALL create each AI video project under `DATA_DIR/projects/<project-id>/` with a `project.json`, `uploads/`, `derived/`, `previews/`, and `output/` directory.

#### Scenario: Create a project

- **WHEN** a user creates a project with a supported canvas preset
- **THEN** the system creates the project directory and persists a project record with an empty timeline and asset list

### Requirement: Managed project assets

The system SHALL assign every uploaded asset a project-local asset ID and SHALL resolve renderer input only through the persisted asset list.

#### Scenario: Reject an unregistered path

- **WHEN** a timeline or build request references a path instead of a registered asset ID
- **THEN** the system rejects the request without reading that path

#### Scenario: Preserve generated files separately

- **WHEN** the system generates a thumbnail, preview, poster, or final video for a project
- **THEN** it writes the file to the project's `derived/`, `previews/`, or `output/` directory rather than the upload directory

### Requirement: Supported canvas presets

The system SHALL support exactly `vertical` at 1080x1920 and `horizontal` at 1920x1080, both at 30 fps, for AI video projects.

#### Scenario: Reject an unsupported canvas

- **WHEN** a project request specifies an unsupported canvas preset or arbitrary dimensions
- **THEN** the system rejects the request with the supported presets
