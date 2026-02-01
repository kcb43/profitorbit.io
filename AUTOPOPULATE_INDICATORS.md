# Auto-Populate Indicators Implementation Guide

## Overview
This guide shows how to add auto-populate indicators to form fields in CrosslistComposer.

## Component Already Created
The `AutoPopulatedBadge` component is already defined in `CrosslistComposer.jsx`:

```jsx
const AutoPopulatedBadge = () => (
  <span 
    className="inline-flex items-center gap-1 ml-1.5 px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded border border-blue-200 dark:border-blue-800"
    title="Auto-populated from import"
  >
    <Download className="w-2.5 h-2.5" />
    Auto
  </span>
);
```

## State Management
The `autoPopulatedFields` state tracks which fields were auto-populated from imports:

```jsx
const [autoPopulatedFields, setAutoPopulatedFields] = useState({});
```

## How to Use

### 1. Update populateTemplates Function
Find the `populateTemplates` function and update it to set autoPopulatedFields:

```jsx
const populateTemplates = (item) => {
  const result = createInitialTemplateState(item);
  setTemplateForms(result.forms);
  setAutoPopulatedFields(result.autoPopulated || {});
  // ... rest of function
};
```

### 2. Add Indicator to Labels
For each field that can be auto-populated, update its label:

**Example for Title field:**
```jsx
<Label htmlFor="general-title" className="text-xs mb-1.5 block">
  Title <span className="text-red-500">*</span>
  {autoPopulatedFields.title && <AutoPopulatedBadge />}
</Label>
```

**Example for Description:**
```jsx
<Label htmlFor="general-description" className="text-xs">
  Description <span className="text-red-500">*</span>
  {autoPopulatedFields.description && <AutoPopulatedBadge />}
</Label>
```

## Fields to Add Indicators To
Add the badge to these fields when they're auto-populated:
- Title (`autoPopulatedFields.title`)
- Description (`autoPopulatedFields.description`)
- Brand (`autoPopulatedFields.brand`)
- Condition (`autoPopulatedFields.condition`)
- Size (`autoPopulatedFields.size`)
- Listing Price (`autoPopulatedFields.price`)

## Implementation Checklist
- [x] Create AutoPopulatedBadge component
- [x] Add autoPopulatedFields state
- [x] Update createInitialTemplateState to return autoPopulated
- [ ] Update populateTemplates to set autoPopulatedFields
- [ ] Add badges to Title label
- [ ] Add badges to Description label
- [ ] Add badges to Brand label
- [ ] Add badges to Condition label
- [ ] Add badges to Size label
- [ ] Add badges to Listing Price label

## Testing
1. Import an item from Facebook or Mercari
2. Navigate to Crosslist Composer with that item
3. Verify that auto-populated fields show the blue "Auto" badge
4. Manually edit a field - badge should remain (it only indicates the initial source)
