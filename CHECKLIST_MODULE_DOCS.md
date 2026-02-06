# Inspection Checklist Manager Module

## Overview

The Inspection Checklist Manager is a comprehensive Vue 3 / Pinia-based module that allows users to manage inspection checklists by selecting relevant protocol questions for each inspected specialty. The module organizes questions by topic, provides filtering and bulk selection capabilities, and persists selections to the database.

## Architecture

### Stores

#### `protocolQuestionStore.js`
Manages the master database of protocol questions with the following key features:
- **State:**
  - `protocolQuestions`: Flat map of all protocol questions by ID
  - `questionsBySpecialty`: Questions grouped by specialty
  - `questionsByTopic`: Questions grouped by topic for each specialty
  - `loading`: Loading state flag
  - `error`: Error message storage

- **Actions:**
  - `getQuestionsBySpecialty(specialtyId)`: Fetches all active questions for a specialty, groups them by topic, and sorts by sequence
  - `getProtocolQuestion(questionId)`: Fetches a single protocol question, with caching
  - `getAllProtocolQuestions()`: Fetches all active protocol questions
  - `clearSpecialtyCache(specialtyId)`: Clears cached data for a specific specialty
  - `clearAll()`: Clears all cached data

- **Getters:**
  - `getQuestionsByTopicForSpecialty(specialtyId)`: Returns grouped questions for a specialty
  - `getQuestionById(questionId)`: Returns a specific question by ID
  - `isLoadedForSpecialty(specialtyId)`: Checks if questions are loaded for a specialty

#### `inspectionQuestionStore.js`
Manages the inspection-specific question selections with the following key features:
- **State:**
  - `inspectionQuestions`: Flat map of all inspection questions by ID
  - `inspectionQuestionsBySpecialty`: Inspection questions grouped by inspected specialty
  - `loading`: Loading state flag
  - `error`: Error message storage

- **Actions:**
  - `getInspectionQuestions(inspectedSpecialtyId)`: Fetches all selected questions for an inspected specialty
  - `addInspectionQuestion(questionData)`: Adds a single inspection question
  - `deleteInspectionQuestion(questionId)`: Deletes a specific inspection question
  - `deleteAllForSpecialty(inspectedSpecialtyId)`: Deletes all inspection questions for a specialty
  - `addMultipleQuestions(inspectedSpecialtyId, protocolQuestionIds)`: Batch adds multiple questions
  - `getSelectedProtocolQuestionIds(inspectedSpecialtyId)`: Returns array of selected protocol question IDs
  - `isQuestionSelected(inspectedSpecialtyId, protocolQuestionId)`: Checks if a question is selected

- **Getters:**
  - `getQuestionsForSpecialty(inspectedSpecialtyId)`: Returns inspection questions for a specialty
  - `getQuestionById(questionId)`: Returns a specific inspection question
  - `isLoadedForSpecialty(inspectedSpecialtyId)`: Checks if questions are loaded for a specialty

### Components

#### `ChecklistManager.vue` (Main Component)
The primary user interface component with the following features:
- **Functionality:**
  - Specialty selector dropdown (populated from inspected specialties)
  - Loads protocol questions grouped by topic when a specialty is selected
  - Pre-selects previously saved inspection questions
  - Provides global "Select All" and "Clear All" buttons
  - Displays selection count vs. total available questions
  - Saves checklist selections to the database

- **Props:** None (uses stores directly)

- **Data:**
  - `selectedInspectedSpecialtyId`: Currently selected specialty
  - `selectedQuestionIds`: Array of selected question IDs
  - `groupedQuestions`: Questions grouped by topic
  - `loading`: Loading state
  - `error`: Error message
  - `successMessage`: Success message

- **Methods:**
  - `onSpecialtyChange()`: Handles specialty selection, loads questions and pre-selections
  - `onSelectedQuestionsChange(newSelection)`: Updates selected questions array
  - `selectAllQuestions()`: Selects all available questions for the specialty
  - `clearAllQuestions()`: Clears all selected questions
  - `saveChecklist()`: Saves the selected questions to the database

#### `TopicChecklistGroup.vue` (Subcomponent)
Displays questions for a single topic with grouping and filtering:
- **Features:**
  - Displays topic name and number of questions
  - Lists all questions in the topic with checkboxes
  - Shows question code and text
  - Expandable question details (verification, regulations, references, sequence)
  - Per-topic "Select All" and "Clear All" buttons
  - Proper question ordering by sequence

- **Props:**
  - `topic`: Object containing topic info and questions
  - `selectedQuestions`: Array of currently selected question IDs

- **Emits:**
  - `update:selected-questions`: Updated array of selected question IDs

## Data Model

### Protocol Question Entity
```javascript
{
  id: String,           // Unique identifier
  activo: Boolean,      // Question is active
  code: String,         // Human-readable code (e.g., "SYS-001")
  normativas: String,   // Link to associated regulations
  references: String,   // References to other documentation
  topic: String,        // Link to Question Topic entity
  sequence: Number,     // Ordering number within topic
  verification: String, // How to verify compliance
  texto: String,        // Question text
  specialty: String,    // Specialty ID the question belongs to
  topicName: String     // Denormalized topic name for display
}
```

### Inspection Question Entity
```javascript
{
  id: String,               // Unique identifier
  code: String,             // Question code
  inspectedSpecialty: String, // Link to inspected specialty
  protocolQuestion: String,  // Link to protocol question
  protocolQuestionId: String // Denormalized protocol question ID
}
```

### Question Topic Entity
```javascript
{
  id: String,
  name: String  // Topic name (e.g., "System Check", "Security")
}
```

### Inspected Specialty Entity
```javascript
{
  id: String,           // Unique identifier
  specialtyName: String, // Display name
  specialtyId: String,  // Link to specialty
  inspectedServiceId: String // Link to inspected service
}
```

## User Workflows

### Selecting a Specialty and Creating a Checklist
1. User clicks "Inspection Checklist" in the navigation
2. Selects a specialty from the dropdown
3. The module loads all active protocol questions for that specialty
4. Previously saved inspection questions are pre-selected (if any exist)
5. Questions are displayed grouped by topic, ordered by sequence
6. User can:
   - Select/deselect individual questions
   - Use "Select All Questions" to select all available questions
   - Use "Clear All Questions" to deselect all questions
   - Use per-topic "Select All" to select all in a topic
   - Use per-topic "Clear All" to deselect all in a topic
   - Expand question details to view verification, regulations, and references
7. User clicks "Save Checklist" to persist selections
8. Confirmation message appears upon successful save

### Pre-Selection of Existing Questions
- When a specialty is selected, the system checks if inspection questions already exist
- Previously selected questions are automatically checked in the interface
- User can modify the selection and save again, which:
  - Deletes all existing inspection questions for the specialty
  - Creates new inspection questions for the newly selected questions

## API Integration

The module uses the existing `apiEntityCRUD` and `apiEntityLinks` functions from `apiServices.js`:

### Queries
- **ProtocolQuestion**: Query by `specialty: specialtyId` and `activo: true`
- **InspectionQuestion**: Query by `inspectedSpecialty: inspectedSpecialtyId`

### Mutations
- **Add InspectionQuestion**: Create new records with code, inspectedSpecialty, protocolQuestion
- **Delete InspectionQuestion**: Delete by question ID
- **Batch Operations**: Multiple adds/deletes handled sequentially

## Styling

The module uses the existing CSS variables and follows the application's design system:
- **Primary Color**: `#214d72` (deep blue)
- **Secondary Color**: `#1e88e5` (bright blue)
- **Light Blue Background**: `#e3f2fd`
- **Border Color**: `#cfd8dc` (light gray)
- **Shadow Color**: `rgba(0,0,0,0.1)` (subtle)

### Responsive Design
- Mobile-friendly layout with collapsible sections
- Flexible button groups that stack on smaller screens
- Proper touch targets for all interactive elements

## Testing

### Unit Tests
- **`protocolQuestionStore.test.js`**: Tests for protocol question store actions and getters
- **`inspectionQuestionStore.test.js`**: Tests for inspection question store actions and getters
- **`TopicChecklistGroup.test.js`**: Component tests for question grouping and selection
- **`ChecklistManager.test.js`**: Component tests for specialty selection and checklist saving

### Test Coverage
- Store mutations and actions
- Component rendering and user interactions
- Error handling and edge cases
- API integration with mocked responses

## Usage Example

```vue
<!-- In App.vue or any parent component -->
<template>
  <ChecklistManager />
</template>

<script setup>
import ChecklistManager from './components/ChecklistManager.vue';
</script>
```

## Performance Considerations

1. **Caching**: Questions are cached in stores to avoid repeated API calls
2. **Lazy Loading**: Questions are only loaded when a specialty is selected
3. **Batch Operations**: Multiple question adds/deletes are handled efficiently
4. **Debounced Selection**: Selection updates use v-model debouncing

## Future Enhancements

1. **Search/Filter**: Add ability to search for questions by code or text
2. **Favorites**: Allow users to mark frequently used questions as favorites
3. **Export**: Export checklists as PDF or CSV
4. **Templates**: Save and reuse checklist templates for recurring inspections
5. **Validation**: Add business logic validation (e.g., minimum questions required)
6. **Audit Log**: Track who made changes and when
7. **Collaboration**: Real-time updates for team-based checklist creation

## Troubleshooting

### No questions appear after selecting a specialty
- Check that the specialty has active protocol questions in the database
- Verify the specialty ID is correct
- Check browser console for API errors

### Previously selected questions not pre-selected
- Ensure the inspection specialty ID is correct
- Check that inspection question records exist in the database
- Clear browser cache if data is stale

### Save fails silently
- Check browser console for API errors
- Verify network connectivity
- Ensure proper API server configuration

## Integration Points

This module integrates with:
- **InspectionManager.vue**: Uses the same inspection context
- **BaseManager.vue**: Inherits styling and layout patterns
- **Pinia Store System**: Follows store architecture of other modules
- **API Services**: Uses standardized CRUD operations
- **Toast Notifications**: For user feedback on save/error actions
