# Inspection Checklist Manager - Developer Guide

## Table of Contents
1. [Module Overview](#module-overview)
2. [Architecture](#architecture)
3. [File Structure](#file-structure)
4. [Store Architecture](#store-architecture)
5. [Component Architecture](#component-architecture)
6. [API Integration](#api-integration)
7. [Testing](#testing)
8. [Development Workflow](#development-workflow)
9. [Code Examples](#code-examples)
10. [Maintenance](#maintenance)

## Module Overview

The Inspection Checklist Manager is a comprehensive feature for managing inspection question checklists. It allows users to:
- Select an inspected specialty
- View available protocol questions grouped by topic
- Select relevant questions for the inspection
- Save selections to persistent storage
- Pre-select previously saved questions

## Architecture

### High-Level Flow
```
User Selects Specialty
        ↓
Load Protocol Questions (protocolQuestionStore)
        ↓
Load Inspection Questions (inspectionQuestionStore)
        ↓
Render Questions Grouped by Topic (ChecklistManager + TopicChecklistGroup)
        ↓
User Selects Questions
        ↓
Save Checklist (inspectionQuestionStore)
        ↓
Persist to Database
```

### Technology Stack
- **Vue 3**: Composition API with `<script setup>`
- **Pinia**: State management
- **Axios**: HTTP requests (via existing apiServices)
- **Vitest**: Unit testing
- **Vue Test Utils**: Component testing

## File Structure

```
src/
├── stores/
│   ├── protocolQuestionStore.js       # Master question database
│   └── inspectionQuestionStore.js     # Question selections
│
├── components/
│   ├── ChecklistManager.vue           # Main container component
│   └── TopicChecklistGroup.vue        # Topic grouping subcomponent
│
└── App.vue                            # Updated with new navigation

tests/
├── protocolQuestionStore.test.js      # 35+ tests for protocol store
├── inspectionQuestionStore.test.js    # 45+ tests for inspection store
├── TopicChecklistGroup.test.js        # 30+ tests for topic component
└── ChecklistManager.test.js           # 35+ tests for main component

Documentation/
├── CHECKLIST_MODULE_DOCS.md           # Comprehensive technical docs
├── CHECKLIST_QUICK_START.md           # User guide
└── CHECKLIST_IMPLEMENTATION_SUMMARY.md # Implementation details
```

## Store Architecture

### protocolQuestionStore.js

**Purpose**: Manages the master database of protocol questions

**State Structure**:
```javascript
{
  protocolQuestions: {
    [questionId]: {
      id, code, texto, topic, topicName, sequence,
      verification, normativas, references, specialty, activo
    }
  },
  questionsBySpecialty: {
    [specialtyId]: {
      [topicId]: {
        id, name,
        questions: [{ id, code, texto, ... }]
      }
    }
  },
  loading: Boolean,
  error: String
}
```

**Key Methods**:
```javascript
// Fetch and group questions
await store.getQuestionsBySpecialty(specialtyId)
// Returns: { [topicId]: { id, name, questions: [...] } }

// Get single question with caching
await store.getProtocolQuestion(questionId)
// Returns: Question object

// Fetch all active questions
await store.getAllProtocolQuestions()
// Returns: Array of all questions

// Cache management
store.clearSpecialtyCache(specialtyId)
store.clearAll()
```

**Getters**:
```javascript
store.getQuestionsByTopicForSpecialty(specialtyId)
// Returns: Grouped questions for specialty

store.getQuestionById(questionId)
// Returns: Question object or null

store.isLoadedForSpecialty(specialtyId)
// Returns: Boolean
```

### inspectionQuestionStore.js

**Purpose**: Manages inspection-specific question selections

**State Structure**:
```javascript
{
  inspectionQuestions: {
    [questionId]: {
      id, code, inspectedSpecialty, protocolQuestion
    }
  },
  inspectionQuestionsBySpecialty: {
    [inspectedSpecialtyId]: [
      { id, code, inspectedSpecialty, protocolQuestion }
    ]
  },
  loading: Boolean,
  error: String
}
```

**Key Methods**:
```javascript
// Fetch saved selections
await store.getInspectionQuestions(inspectedSpecialtyId)
// Returns: Array of inspection questions

// Add single selection
await store.addInspectionQuestion({
  code, inspectedSpecialty, protocolQuestion
})
// Returns: Created question object

// Batch add multiple
await store.addMultipleQuestions(
  inspectedSpecialtyId,
  [protocolQuestionId1, protocolQuestionId2, ...]
)
// Returns: Array of created questions

// Delete operations
await store.deleteInspectionQuestion(questionId)
await store.deleteAllForSpecialty(inspectedSpecialtyId)

// Query methods
store.getSelectedProtocolQuestionIds(inspectedSpecialtyId)
store.isQuestionSelected(inspectedSpecialtyId, protocolQuestionId)

// Cache management
store.clearSpecialtyCache(inspectedSpecialtyId)
store.clearAll()
```

## Component Architecture

### ChecklistManager.vue (Main Component)

**Props**: None (uses stores directly)

**Emits**: None (emits to child components only)

**Data**:
```javascript
selectedInspectedSpecialtyId    // 'NONE' or specialty ID
selectedQuestionIds             // Array of selected question IDs
groupedQuestions                // Questions by topic
loading                         // Loading state
error                           // Error message
successMessage                  // Success notification
```

**Methods**:
```javascript
// Called when specialty changes
onSpecialtyChange()

// Called when child component updates selections
onSelectedQuestionsChange(newSelection)

// Global selection buttons
selectAllQuestions()
clearAllQuestions()

// Save to database
saveChecklist()
```

**Computed Properties**:
```javascript
sortedTopics                // Topics sorted by name
totalQuestionCount          // Total questions for specialty
availableInspectedSpecialties // Dropdown options
```

**Lifecycle**:
- `onMounted()`: Initialize inspected specialty store

### TopicChecklistGroup.vue (Subcomponent)

**Props**:
```javascript
{
  topic: {                    // Topic object
    id: String,
    name: String,
    questions: Array
  },
  selectedQuestions: Array    // IDs of selected questions
}
```

**Emits**:
```javascript
'update:selected-questions' // Sends updated selection array
```

**Data**:
```javascript
expandedQuestions           // Track expanded question details
```

**Methods**:
```javascript
toggleDetails(questionId)           // Expand/collapse details
toggleQuestion(questionId)          // Select/deselect question
selectAllInTopic()                 // Select all in topic
deselectAllInTopic()               // Deselect all in topic
```

**Helper Functions**:
```javascript
isSelected(questionId)              // Check if question selected
hasDetails(question)                // Check if question has details
```

## API Integration

### API Endpoints Used

**1. Query Protocol Questions**
```javascript
apiEntityCRUD('query', 'ProtocolQuestion', null, {
  specialty: specialtyId,
  activo: true
})
```

**2. Query Inspection Questions**
```javascript
apiEntityCRUD('query', 'InspectionQuestion', null, {
  inspectedSpecialty: inspectedSpecialtyId
})
```

**3. Add Inspection Question**
```javascript
apiEntityCRUD('add', 'InspectionQuestion', null, {
  code: questionCode,
  inspectedSpecialty: inspectedSpecialtyId,
  protocolQuestion: protocolQuestionId
})
```

**4. Delete Inspection Question**
```javascript
apiEntityCRUD('delete', 'InspectionQuestion', questionId)
```

### Data Models

**Protocol Question** (from database):
```javascript
{
  id: String,
  activo: Boolean,
  code: String,
  normativas: String,
  references: String,
  topic: String,              // Link to topic ID
  topicName: String,          // Denormalized
  sequence: Number,
  verification: String,
  texto: String,
  specialty: String
}
```

**Inspection Question** (created/managed):
```javascript
{
  id: String,
  code: String,
  inspectedSpecialty: String, // Link to inspected specialty
  protocolQuestion: String,   // Link to protocol question
  protocolQuestionId: String  // Denormalized
}
```

## Testing

### Test Structure

Each test file follows this pattern:
```javascript
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Module/Component Name', () => {
  let mockStore;

  beforeEach(() => {
    // Setup mocks
    vi.clearAllMocks();
  });

  describe('Feature Group', () => {
    it('should do X when Y happens', () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### Running Tests

```bash
# Run all tests
npm run test

# Run specific test file
npm run test protocolQuestionStore

# Run with UI
npm run test:ui

# Run with coverage
npm run test -- --coverage
```

### Test Coverage

**protocolQuestionStore.test.js** (35+ tests):
- Question fetching and grouping
- Topic sorting
- Caching behavior
- Error handling
- Loading states
- Getters

**inspectionQuestionStore.test.js** (45+ tests):
- Fetching saved selections
- Adding/deleting questions
- Batch operations
- Pre-selection logic
- Cache management
- Query methods

**TopicChecklistGroup.test.js** (30+ tests):
- Rendering
- Checkbox interactions
- Select/deselect all
- Details expansion
- Event emissions
- Edge cases

**ChecklistManager.test.js** (35+ tests):
- Specialty selection
- Question loading
- Pre-selection
- Global controls
- Checklist saving
- Error handling

## Development Workflow

### Adding a New Feature

1. **Identify the layer**:
   - Data logic → Store
   - UI logic → Component
   - Both → Both

2. **Add store logic** (if needed):
   ```javascript
   actions: {
     async myNewAction(params) {
       try {
         // Implementation
       } catch (error) {
         this.error = error.message;
         throw new Error('myNewAction: ' + error.message);
       }
     }
   }
   ```

3. **Add component logic** (if needed):
   ```javascript
   const myNewMethod = async () => {
     try {
       loading.value = true;
       error.value = null;
       // Call store action
       await store.myNewAction();
     } catch (err) {
       error.value = err.message;
     } finally {
       loading.value = false;
     }
   };
   ```

4. **Write tests**:
   ```javascript
   it('should do X when Y happens', async () => {
     // Test implementation
   });
   ```

5. **Update documentation**:
   - Update CHECKLIST_MODULE_DOCS.md
   - Add JSDoc comments
   - Update this guide if necessary

### Debugging

**Enable store debugging**:
```javascript
import { useProtocolQuestionStore } from '../stores/protocolQuestionStore';
const store = useProtocolQuestionStore();
console.log(store.$state); // View entire state
console.log(store.protocolQuestions); // View specific part
```

**Enable component debugging**:
```javascript
console.log('selectedQuestions:', selectedQuestionIds.value);
console.log('groupedQuestions:', groupedQuestions.value);
```

**Check API calls**:
- Open browser DevTools → Network tab
- Look for requests to `/queryEntity`, `/addEntity`, `/deleteEntity`
- Check request/response bodies

## Code Examples

### Using the Checklist Module in Another Component

```vue
<template>
  <button @click="loadChecklist">Load Checklist</button>
  <div v-if="questions">
    <p>{{ selectedCount }} / {{ totalCount }} questions selected</p>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue';
import { useProtocolQuestionStore } from '../stores/protocolQuestionStore';
import { useInspectionQuestionStore } from '../stores/inspectionQuestionStore';

const protocolStore = useProtocolQuestionStore();
const inspectionStore = useInspectionQuestionStore();

const specialtyId = ref('S1');
const questions = ref(null);

const loadChecklist = async () => {
  try {
    // Load protocol questions
    const grouped = await protocolStore.getQuestionsBySpecialty(specialtyId.value);
    questions.value = grouped;
    
    // Load saved selections
    const saved = await inspectionStore.getInspectionQuestions('IS1');
    console.log('Previously selected:', saved);
  } catch (error) {
    console.error('Failed to load:', error);
  }
};

const selectedCount = computed(() => {
  // Count selected questions
  return inspectionStore.inspectionQuestionsBySpecialty['IS1']?.length || 0;
});

const totalCount = computed(() => {
  // Count all questions
  let count = 0;
  for (const topic of Object.values(questions.value || {})) {
    count += topic.questions.length;
  }
  return count;
});
</script>
```

### Extending the Store

```javascript
// In protocolQuestionStore.js
actions: {
  async getQuestionsByTopic(topicId) {
    try {
      const { data: queryResults } = await apiEntityCRUD('query', 'ProtocolQuestion', null, {
        topic: topicId,
        activo: true,
      });
      // Process results
      return queryResults.list;
    } catch (error) {
      throw new Error('getQuestionsByTopic: ' + error.message);
    }
  }
}
```

## Maintenance

### Regular Tasks

**Monthly**:
- Review test coverage
- Check for deprecations
- Update dependencies

**Quarterly**:
- Performance profiling
- Cache effectiveness analysis
- User feedback incorporation

### Common Issues and Solutions

**Issue**: Questions not loading for specialty
- **Solution**: Check if specialty ID is correct, verify API connection

**Issue**: Pre-selected questions not showing
- **Solution**: Clear browser cache, verify inspection questions exist

**Issue**: Save fails silently
- **Solution**: Check browser console, verify network, check server logs

### Performance Optimization

**Current optimizations**:
- ✅ Question caching in store
- ✅ Lazy loading (only load when specialty selected)
- ✅ Batch operations for multiple questions
- ✅ Efficient v-model bindings

**Future optimizations**:
- Implement virtual scrolling for large question lists
- Add pagination
- Cache with TTL
- Debounce selection updates

### Version History

**v1.0** (February 2026):
- Initial implementation
- Full feature set
- Comprehensive testing
- Complete documentation

---

**Last Updated**: February 2026  
**Maintainer**: Development Team  
**Status**: Production Ready
