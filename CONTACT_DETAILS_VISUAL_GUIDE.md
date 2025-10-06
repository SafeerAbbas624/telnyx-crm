# Contact Details Drawer - Visual Design Guide

## 📐 Layout Structure

```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    John Doe                          [Edit Contact]     │
│            Contact Details                                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  CONTACT OVERVIEW CARD                                   │   │
│  │  ┌────┐                                                  │   │
│  │  │ JD │  John Doe                                        │   │
│  │  └────┘  ABC Properties LLC                              │   │
│  │          [Lead] [Do Not Call]                            │   │
│  │                                                           │   │
│  │  🏷️ Hot Lead    VIP    Florida                          │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  📞 Phone          ✉️ Email           📍 Address         │   │
│  │  (754) 294-7595   john@email.com    123 Main St         │   │
│  │  (305) 123-4567   john2@email.com                        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  🏠 PROPERTY INFORMATION                                 │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  Property Address: 456 Oak Avenue                        │   │
│  │  Location: Miami, FL, Miami-Dade                         │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐               │   │
│  │  │  3   │  │  2   │  │2,500 │  │ 2015 │               │   │
│  │  │ Beds │  │ Bath │  │Sq Ft │  │Built │               │   │
│  │  └──────┘  └──────┘  └──────┘  └──────┘               │   │
│  │                                                           │   │
│  │  Property Type: Single Family                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  💰 FINANCIAL INFORMATION                                │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │   │
│  │  │ Est. Value  │  │ Debt Owed   │  │ Est. Equity │     │   │
│  │  │  $500,000   │  │  $300,000   │  │  $200,000   │     │   │
│  │  │   (blue)    │  │    (red)    │  │   (green)   │     │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘     │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │  👤 ADDITIONAL INFORMATION                               │   │
│  │  ─────────────────────────────────────────────────────   │   │
│  │  Notes: Very interested in selling. Call back next week │   │
│  │                                                           │   │
│  │  Created: 01/15/2024    Last Updated: 01/20/2024        │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
├═════════════════════════════════════════════════════════════════┤
│  [Timeline] [Notes] [Activities] [Calls] [Messages] [Emails]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Tab Content Area (unchanged)                                   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Color Scheme

### **Status Badges**
- **Lead**: Outline badge (gray border)
- **Negotiating**: Secondary badge (gray background)
- **Closed**: Default badge (blue background)
- **DNC**: Destructive badge (red background with alert icon)

### **Tags**
- Custom colors from database
- Light background (color + 15% opacity)
- Border and text in tag color

### **Quick Contact Icons**
- **Phone**: Blue (`text-blue-600`)
- **Email**: Green (`text-green-600`)
- **Address**: Red (`text-red-600`)

### **Financial Boxes**
- **Estimated Value**: Blue background (`bg-blue-50`, border `border-blue-200`, text `text-blue-900`)
- **Debt Owed**: Red background (`bg-red-50`, border `border-red-200`, text `text-red-900`)
- **Estimated Equity**: Green background (`bg-green-50`, border `border-green-200`, text `text-green-900`)

### **Action Buttons**
- **Call Button**: Green (`bg-green-600 hover:bg-green-700`)
- **Message Button**: Blue (`bg-blue-600 hover:bg-blue-700`)
- **Email Button**: Purple (`bg-purple-600 hover:bg-purple-700`)

---

## 📱 Responsive Behavior

### **Desktop (lg+)**
- Contact Overview: 3-column grid for quick info
- Property Stats: 4 boxes in a row
- Financial: 3 boxes in a row

### **Tablet (md)**
- Contact Overview: 3-column grid maintained
- Property Stats: 4 boxes in a row
- Financial: 3 boxes in a row

### **Mobile (sm)**
- Contact Overview: 1-column stack
- Property Stats: 2x2 grid
- Financial: 1-column stack

---

## 🔤 Typography

### **Headers**
- Contact Name: `text-2xl font-bold text-gray-900`
- Company: `text-sm text-gray-600`
- Card Titles: `text-lg` with icon

### **Labels**
- Field Labels: `text-xs text-gray-500`
- Quick Info Labels: `text-xs text-gray-500 mb-1`

### **Values**
- Primary Values: `text-sm font-medium text-gray-900`
- Secondary Values: `text-sm text-gray-600`
- Financial Values: `text-2xl font-bold` (color-coded)
- Stats Values: `text-lg font-bold text-gray-900`

---

## 🎯 Component Hierarchy

```
ContactDetails
├── Header (Back button, Name, Edit button)
├── Upper Panel (Resizable)
│   ├── Contact Overview Card
│   │   ├── Avatar + Name + Company
│   │   ├── Status Badges
│   │   ├── Tags
│   │   └── Quick Contact Info (3 columns)
│   ├── Property Information Card
│   │   ├── Property Tabs (if multiple)
│   │   ├── Address Section
│   │   ├── Stats Grid (4 boxes)
│   │   └── Property Type
│   ├── Financial Information Card
│   │   └── 3 Colored Boxes
│   └── Additional Information Card (conditional)
│       ├── Notes
│       ├── DNC Reason
│       └── Timestamps
├── Resize Handle
└── Lower Panel (Tabs)
    ├── Timeline Tab
    ├── Notes Tab
    ├── Activities Tab
    ├── Calls Tab (with Call button)
    ├── Messages Tab (with Message button)
    └── Emails Tab (with Email button)
```

---

## 🎭 Avatar Design

```
┌────────────┐
│            │
│     JD     │  ← Initials (first letter of first + last name)
│            │
└────────────┘
```

- Size: `h-16 w-16`
- Shape: `rounded-full`
- Background: `bg-gradient-to-br from-blue-500 to-purple-600`
- Text: `text-white text-2xl font-bold`
- Centered: `flex items-center justify-center`

---

## 📊 Property Stats Boxes

```
┌─────────────┐
│             │
│  Bedrooms   │  ← Label (text-xs text-gray-500)
│      3      │  ← Value (text-lg font-bold)
│             │
└─────────────┘
```

- Background: `bg-gray-50`
- Border: `rounded-lg`
- Padding: `p-3`
- Alignment: `text-center`

---

## 💰 Financial Boxes

```
┌─────────────────────┐
│                     │
│  Estimated Value    │  ← Label (text-xs, color-coded)
│                     │
│    $500,000         │  ← Value (text-2xl font-bold, color-coded)
│                     │
└─────────────────────┘
```

- Padding: `p-4`
- Border: `rounded-lg border`
- Background: Color-coded (blue-50, red-50, green-50)
- Border: Color-coded (blue-200, red-200, green-200)
- Text: Color-coded (blue-900, red-900, green-900)

---

## 🏷️ Tags Display

```
🏷️ [Hot Lead] [VIP] [Florida] [Motivated Seller]
```

- Icon: Tag icon from Lucide
- Badges: `variant="outline"`
- Custom styling: Background, border, and text color from tag.color
- Flex wrap: `flex-wrap` for multiple tags
- Gap: `gap-2`

---

## 🔘 Action Buttons

### **Calls Tab**
```
┌──────────────┐
│ 📞 Call      │  ← Green button
└──────────────┘
```

### **Messages Tab**
```
┌──────────────┐
│ ➕ Message   │  ← Blue button
└──────────────┘
```

### **Emails Tab**
```
┌──────────────┐
│ ➕ Email     │  ← Purple button
└──────────────┘
```

- Size: `size="sm"`
- Variant: `variant="default"`
- Icon: Left-aligned with `mr-2`
- Custom colors: Applied via className

---

## 📐 Spacing & Padding

- **Card Padding**: `p-6` (top section), `pt-6` (card content)
- **Card Margin**: `mb-4` (between cards)
- **Grid Gap**: `gap-4` (most grids)
- **Section Gap**: `mb-4` (between sections within cards)
- **Border Spacing**: `pb-4 border-b` (for dividers)

---

## 🎨 Background Colors

- **Main Container**: `bg-gray-50` (light gray for contrast)
- **Cards**: `bg-white` (white cards on gray background)
- **Stats Boxes**: `bg-gray-50` (subtle gray)
- **Financial Boxes**: Color-coded (blue-50, red-50, green-50)

---

## ✨ Visual Enhancements

1. **Gradient Avatar**: Eye-catching blue-to-purple gradient
2. **Icon-Based Sections**: Icons help identify information types quickly
3. **Color-Coded Finances**: Instant visual understanding (blue=value, red=debt, green=equity)
4. **Status Badges**: Clear visual indicators of deal status and DNC
5. **Tag Colors**: Custom colors make tags stand out
6. **Centered Stats**: Easy-to-scan property statistics
7. **Card Shadows**: Subtle shadows for depth (default Card component)
8. **Hover States**: All buttons have hover effects

---

## 🎯 Design Principles Applied

1. **Visual Hierarchy**: Most important info (name, status) at top
2. **Grouping**: Related information grouped in cards
3. **Scannability**: Icons, colors, and spacing make scanning easy
4. **Consistency**: Same patterns used throughout (labels, values, spacing)
5. **Clarity**: Clear labels and formatted values
6. **Accessibility**: Good color contrast, readable font sizes
7. **Professional**: Matches industry-standard CRM designs

---

## 🚀 Comparison to Industry Standards

### **Salesforce**
✅ Card-based layout
✅ Avatar with initials
✅ Status badges
✅ Icon-based quick info
✅ Grouped sections

### **HubSpot**
✅ Clean, modern design
✅ Color-coded information
✅ Clear visual hierarchy
✅ Action buttons in context

### **Pipedrive**
✅ Prominent contact name
✅ Financial information highlighted
✅ Tags displayed prominently
✅ Easy-to-scan layout

**Result**: Our design matches or exceeds industry standards! 🎉

