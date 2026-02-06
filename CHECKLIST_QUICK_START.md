# Inspection Checklist Manager - Quick Start Guide

## Overview
The Inspection Checklist Manager allows users to manage inspection checklists by selecting relevant protocol questions for each inspected specialty. Questions are organized by topic, with full details available for each question.

## How to Use

### 1. Navigate to the Checklist Manager
- Click the **"Inspection Checklist"** button in the main navigation
- The checklist interface will display

### 2. Select a Specialty
- Use the **"Select Specialty"** dropdown at the top
- Choose an inspected specialty
- The system automatically loads all available questions for that specialty

### 3. View Questions
- Questions are grouped by **Topic** (e.g., "System Check", "Security")
- Each topic section shows:
  - Topic name and number of questions
  - Individual questions with code and text
  - Checkboxes for selection
  - Expand buttons (+/-) to view details

### 4. View Question Details
- Click the **+** button next to a question to expand details
- Details include:
  - **Sequence**: Question ordering number
  - **Verification**: How to verify compliance
  - **Regulations**: Associated normative references
  - **References**: Links to related documentation
- Click **−** to collapse details

### 5. Select Questions

#### Individual Selection
- Click the checkbox next to a question to select/deselect it
- Selected questions are highlighted with a checkmark

#### Per-Topic Selection
- In each topic section, use:
  - **"Select All"** button (green) - Select all questions in the topic
  - **"Clear All"** button (orange) - Deselect all questions in the topic

#### Global Selection
- Below the specialty selector, use:
  - **"Select All Questions"** button - Select all available questions
  - **"Clear All Questions"** button - Deselect all questions

### 6. Monitor Selection
- A counter at the bottom shows: **"X / Y questions selected"**
- This helps you track your selections

### 7. Save the Checklist
- Click the **"Save Checklist"** button at the bottom
- A success message will appear if the save was successful
- If any errors occur, an error message will display

## Key Features

### Pre-Selection
If you've previously saved a checklist for a specialty:
- Those questions will be **automatically pre-selected** when you choose that specialty
- You can modify the selection and save again

### Responsive Design
- Works on desktop, tablet, and mobile devices
- Buttons and text scale appropriately
- Touch-friendly checkboxes

### Error Handling
- If something goes wrong, you'll see a clear error message
- Close error messages with the **×** button
- Use error messages to troubleshoot issues

## Common Tasks

### Create a New Checklist
1. Select a specialty that doesn't have a checklist
2. Select questions using any selection method
3. Click "Save Checklist"

### Modify an Existing Checklist
1. Select the specialty with the existing checklist
2. The previous selections will be pre-selected
3. Add or remove questions as needed
4. Click "Save Checklist"

### Start Fresh for a Specialty
1. Select the specialty
2. Click "Clear All Questions" to deselect everything
3. Save the checklist with no questions

### Quickly Select All Questions
1. Select the specialty
2. Click "Select All Questions"
3. Immediately save or make adjustments

### Select Questions from One Topic Only
1. Select the specialty
2. Use "Clear All Questions" first (optional)
3. Click "Select All" on the specific topic
4. Save the checklist

## Tips & Tricks

✅ **Use per-topic buttons** when you only need questions from specific topics  
✅ **Expand details** to understand question requirements and verification methods  
✅ **Check the selection counter** before saving to verify your selections  
✅ **Modify and save** - you can change selections and save as many times as needed  
✅ **Review question codes** - they provide quick reference for question types  

## Troubleshooting

### No questions appear
- ✓ Verify the specialty has been selected
- ✓ Check that the specialty has active protocol questions
- ✓ Refresh the page and try again

### Previous selections not showing
- ✓ The specialty selection may not have loaded properly
- ✓ Try refreshing the page
- ✓ Select a different specialty and then select again

### Save is slow or fails
- ✓ Check your internet connection
- ✓ Check the browser console for error messages
- ✓ Try again after a few seconds
- ✓ If persistent, contact system administrator

## Data Saved

When you save a checklist, the system stores:
- Which protocol questions you selected
- The inspected specialty they belong to
- A unique identifier for each selection

You can always modify these selections later.

## API Integration

The checklist manager works with:
- **Protocol Questions**: The master question database (read-only)
- **Inspection Questions**: Your selections for this inspection specialty (create/update/delete)

All data is synced with the backend immediately upon saving.

## Keyboard Shortcuts (Optional Enhancement)

While not currently implemented, future versions may support:
- `Ctrl/Cmd + A`: Select All Questions
- `Ctrl/Cmd + Shift + A`: Clear All Questions
- `Tab`: Navigate between questions
- `Space`: Check/uncheck current question

## Support

For issues or questions:
1. Check the **Troubleshooting** section above
2. Review the **Quick Start Guide** for common tasks
3. Contact your system administrator for technical support

---

**Version**: 1.0  
**Last Updated**: February 2026  
**Module**: Inspection Checklist Manager
