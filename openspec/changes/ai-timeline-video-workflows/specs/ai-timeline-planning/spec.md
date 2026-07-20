## ADDED Requirements

### Requirement: AI generates constrained timeline drafts

The system SHALL provide AI with the project canvas, registered assets, compatible catalog entries, and user instruction, and SHALL require a JSON timeline draft.

#### Scenario: Generate a timeline from project assets

- **WHEN** a user asks AI to make a video from a project with valid assets
- **THEN** the system returns a timeline draft that references only the supplied asset IDs and compatible component and transition IDs

### Requirement: Server-side AI timeline validation

The system SHALL validate an AI timeline draft using the same validation used for manual timeline saves before persisting or rendering it.

#### Scenario: Reject AI hallucinated capabilities

- **WHEN** AI returns an unknown asset, component, transition, arbitrary file path, or FFmpeg filter field
- **THEN** the system rejects the draft and does not enqueue a render

### Requirement: AI drafts remain user-editable

The system SHALL save an accepted AI timeline using the same project timeline representation exposed to the time-line editor.

#### Scenario: Edit an accepted AI draft

- **WHEN** a user changes scene order, duration, asset, or compatible transition after accepting an AI draft
- **THEN** the system validates and renders the edited timeline without another AI request
