# Design System — QR Restaurant Ordering System V1

## 1. Overview

This document defines the shared visual tokens, typography, spacing, component conventions, interaction states, and implementation rules for QR Restaurant Ordering System V1.

The design system is built around:

- Warm Minimalist visual identity.
- Modern SaaS dashboard patterns.
- Balanced information density.
- shadcn/ui components.
- Tailwind CSS.
- Lucide icons.

The design system is shared across Customer, Admin, and Staff interfaces.

---

## 2. Technology Standards

| Concern              | Standard                               |
| -------------------- | -------------------------------------- |
| Component foundation | shadcn/ui                              |
| Styling              | Tailwind CSS                           |
| Icons                | Lucide                                 |
| Typography           | Inter                                  |
| Forms                | React Hook Form + Zod                  |
| Charts               | Recharts                               |
| Toast notifications  | Sonner                                 |
| Animation            | CSS transitions; Motion when justified |

### Component Usage Rules

1. Prefer existing shadcn/ui components before implementing custom components.
2. Customize components through shared styles and variants.
3. Do not independently redefine the same component in multiple application areas.
4. Build application-specific components on top of the shared UI foundation.
5. Avoid introducing another component library without a clear requirement.
6. Keep accessibility behavior provided by the underlying component primitives.

---

## 3. Color Tokens

### Brand Colors

Initial palette:

| Token            | Value     | Usage                              |
| ---------------- | --------- | ---------------------------------- |
| Brand Primary    | `#B85C38` | Primary actions and brand emphasis |
| Brand Hover      | `#9F4C2D` | Hover state                        |
| Brand Soft       | `#F8EAE3` | Subtle brand backgrounds           |
| Brand Foreground | `#FFFFFF` | Text on primary buttons            |

### Neutral Colors

| Token            | Value     | Usage                                 |
| ---------------- | --------- | ------------------------------------- |
| Background       | `#FAF8F5` | Main application background           |
| Surface          | `#FFFFFF` | Cards, dialogs, and elevated surfaces |
| Surface Muted    | `#F3F0EC` | Secondary surface                     |
| Foreground       | `#292521` | Primary text                          |
| Muted Foreground | `#6D655E` | Secondary text                        |
| Border           | `#E8E2DC` | Borders and dividers                  |
| Input            | `#E8E2DC` | Input borders                         |
| Ring             | `#B85C38` | Focus indicators                      |

### Semantic Colors

| Meaning     | Foreground | Soft Background |
| ----------- | ---------- | --------------- |
| Success     | `#237A4B`  | `#E8F5EC`       |
| Warning     | `#86520D`  | `#FFF4DB`       |
| Destructive | `#B83232`  | `#FCEAEA`       |
| Information | `#2865A6`  | `#EAF2FC`       |

### Color Rules

- Use semantic tokens instead of hardcoded colors.
- Do not use brand primary for every interactive element.
- Reserve destructive colors for destructive actions and errors.
- Status colors must always be accompanied by readable text or another visual indicator.
- Validate text and component contrast before release.
- The palette above is the initial baseline and may be adjusted after visual QA.

---

## 4. Typography

### Font Family

Primary font: Inter.

Use a consistent font family across all application areas.

### Typography Scale

| Style      | Size | Weight | Usage                            |
| ---------- | ---: | -----: | -------------------------------- |
| Display    | 36px |    700 | Rare prominent customer headings |
| H1         | 28px |    700 | Main page title                  |
| H2         | 22px |    600 | Section title                    |
| H3         | 18px |    600 | Card and subsection title        |
| Body Large | 16px |    400 | Prominent body content           |
| Body       | 14px |    400 | Default interface text           |
| Label      | 14px |    500 | Form labels                      |
| Caption    | 12px |    400 | Supporting information           |

### Typography Rules

- Use consistent heading hierarchy.
- Avoid using bold text for every label.
- Use tabular numbers for prices, totals, and quantities when appropriate.
- Ensure prices remain easy to distinguish from supporting information.
- Avoid excessively small text for operational information.

---

## 5. Spacing System

Use a 4px base spacing unit.

| Token | Value |
| ----- | ----: |
| 1     |   4px |
| 2     |   8px |
| 3     |  12px |
| 4     |  16px |
| 5     |  20px |
| 6     |  24px |
| 8     |  32px |
| 10    |  40px |
| 12    |  48px |
| 16    |  64px |

### Layout Guidelines

- Page content padding: 24px–32px on desktop.
- Page content padding: 16px on mobile.
- Card padding: 16px–24px.
- Form field spacing: 16px.
- Section spacing: 24px–32px.
- Compact operational elements may use smaller spacing when necessary.

Use the closest existing spacing token rather than arbitrary values.

---

## 6. Radius and Elevation

### Border Radius

| Element                |      Radius |
| ---------------------- | ----------: |
| Small controls         |         6px |
| Buttons and inputs     |         8px |
| Cards                  |        12px |
| Dialogs and sheets     |        16px |
| Large image containers |   12px–16px |
| Pills and badges       | Full radius |

### Elevation

Use subtle elevation.

- Default cards: no shadow or very subtle shadow.
- Dropdowns: subtle shadow.
- Dialogs: moderate shadow.
- Popovers: moderate shadow.
- Hovered cards: subtle elevation change only when appropriate.

Borders should generally provide structure before shadows are introduced.

---

## 7. Iconography

Use Lucide icons.

### Rules

- Use consistent icon sizes.
- Use 16px icons for compact controls.
- Use 18px–20px icons for standard actions.
- Use 24px icons for prominent interface elements.
- Avoid mixing icon libraries.
- Avoid decorative icons that do not provide meaning.
- Use labels alongside important operational actions.

---

## 8. Component Standards

### Buttons

Supported variants:

- Default / Primary
- Secondary
- Outline
- Ghost
- Destructive
- Link

Supported sizes:

- Small
- Default
- Large
- Icon

Rules:

- Every primary action should be visually identifiable.
- Avoid multiple primary buttons competing within the same section.
- Destructive actions should use the destructive variant.
- Loading states must prevent accidental duplicate submissions.
- Disabled buttons must be visually distinguishable.

### Forms

Standard form elements:

- Input
- Textarea
- Select
- Checkbox
- Radio Group
- Switch
- Date Picker where required

Rules:

- Every field must have an accessible label.
- Display validation messages close to the relevant field.
- Indicate required fields when necessary.
- Preserve user input when validation fails.
- Use consistent field spacing.
- Use React Hook Form and Zod for form validation.

### Cards

Use cards to group related information.

Types:

- Summary Card
- Menu Card
- Order Card
- Content Card
- Settings Card

Rules:

- Avoid nesting multiple unnecessary card layers.
- Keep card hierarchy clear.
- Use consistent padding and border treatment.

### Tables

Use tables for structured administrative data.

Rules:

- Clear column labels.
- Consistent row spacing.
- Search and filtering where useful.
- Pagination for large datasets.
- Empty state when no records exist.
- Loading skeleton when retrieving data.
- Responsive behavior for smaller screens.
- Important actions should remain easy to access.

### Dialogs and Sheets

Use:

- Dialog for confirmation and focused interactions.
- Sheet for secondary content or forms that benefit from a side panel.
- Full-page form for complex operations.

Destructive actions must provide clear confirmation.

### Badges

Use badges for:

- Status.
- Categories.
- Small contextual indicators.

Avoid using badges for ordinary decorative metadata.

### Feedback Components

Standardize:

- Sonner toast notifications.
- Alert messages.
- Skeleton loading.
- Empty states.
- Error states.
- Confirmation dialogs.

Every asynchronous operation should provide appropriate feedback.

---

## 9. Order and Payment Status Design

Use only the order and payment attempt states defined by the business rules and database model. Keep the two concepts visually distinct; do not invent additional states or imply that kitchen preparation is tracked in V1.

The current V1 data model defines these states:

| Domain | State | Semantic color |
| --- | --- | --- |
| Order | `PENDING_PAYMENT` | Warning |
| Order | `PAID` | Success |
| Order | `CANCELLED` | Destructive |
| Order | `EXPIRED` | Warning |
| Payment attempt | `PENDING` | Warning |
| Payment attempt | `PAID` | Success |
| Payment attempt | `FAILED` | Destructive |
| Payment attempt | `EXPIRED` | Warning |
| Payment attempt | `CANCELLED` | Destructive |

Always pair color with readable status text or another non-color cue. Distinguish order state from payment state through its label or placement as well as color.

Staff kitchen tickets are not order-state controls. The active queue contains paid tickets only. `BARU` is a per-account unread marker, not an order or payment status; opening a ticket clears that account's marker. Do not show prices, discounts, payment methods, or other payment details on active tickets. Historical Staff details remain read-only and may show the full historical order and payment snapshot.

---

## 10. Surface-Specific Component Guidelines

### Customer

Prioritize:

- Restaurant Header
- Menu Category Navigation
- Menu Item Card
- Menu Detail
- Variant Selector
- Add-on Selector
- Quantity Selector
- Cart Summary
- Checkout Summary
- Payment Status
- Order Tracking

Guidelines:

- Food imagery should receive strong visual emphasis.
- Menu cards should remain compact enough for browsing.
- Primary ordering actions should be easy to reach.
- Cart information should remain clear throughout checkout.
- Avoid administrative table layouts.

### Admin

Prioritize:

- Application Sidebar
- Page Header
- Breadcrumbs where useful
- Summary Cards
- Data Tables
- Search and Filter
- Pagination
- Form Layouts
- Dialogs and Sheets
- Settings Panels

Guidelines:

- Use consistent page layouts.
- Keep navigation predictable.
- Show relevant information without overwhelming the page.
- Use balanced density.
- Keep important actions in consistent positions.

### Staff

Prioritize:

- Order Queue
- Order Card
- Order Details
- Per-account `BARU` marker and connection state
- Read-only detail links
- Realtime Update Feedback

Guidelines:

- Prioritize order number, table number, successful payment time, items, quantities, item notes, and customer name when available.
- Use clear visual grouping.
- Keep queue/history navigation and sound controls easy to reach.
- Do not present order-state transitions or payment details on active tickets.
- Ensure good touch-target sizes on tablets.
- Show clear loading, empty, error, offline, and reconnecting feedback.

---

## 11. Responsive Breakpoints

Follow Tailwind CSS responsive breakpoints unless a specific layout requirement justifies an adjustment.

| Breakpoint |       Width | Intended Use  |
| ---------- | ----------: | ------------- |
| Default    | Below 640px | Mobile        |
| sm         |       640px | Large mobile  |
| md         |       768px | Tablet        |
| lg         |      1024px | Small desktop |
| xl         |      1280px | Desktop       |
| 2xl        |      1536px | Large desktop |

Responsive behavior must be designed per application surface.

Do not simply shrink desktop layouts to fit mobile screens.

---

## 12. Interaction States

Interactive components must define:

- Default
- Hover
- Focus-visible
- Active
- Disabled
- Loading
- Error, when applicable

### Interaction Rules

- Provide visible focus indicators.
- Use consistent transitions.
- Keep animation durations short.
- Respect reduced-motion preferences.
- Avoid layout shifts during loading.
- Prevent repeated submissions when an operation is in progress.

### Loading and Motion Patterns

- Use layout-shaped `Skeleton` content for initial asynchronous page content; retain existing content during background refreshes.
- Use the shared `Button` `loading` prop for short actions. Keep the action label visible, expose `aria-busy`, and disable repeat submissions while pending.
- Mark loading content regions with `aria-busy` and provide a concise screen-reader status when the skeleton itself is hidden from assistive technology.
- Use CSS transitions for hover, focus, and pressed states. Dialogs and sheets enter in 200 ms and exit in 150 ms; dropdown feedback stays within 150 ms.
- Keep state changes immediate. Do not add artificial waits or optimistic success for payment or other server-authoritative state.
- Honor `prefers-reduced-motion`; loading and state feedback must remain understandable without animation.

---

## 13. Accessibility Standards

- Use semantic HTML.
- Provide accessible labels.
- Maintain sufficient color contrast.
- Support keyboard navigation.
- Provide visible focus states.
- Do not communicate status using color alone.
- Ensure touch targets are practical.
- Frequently used mobile controls should aim for a 44px hit area; compact variants may remain for dense desktop workflows.
- Provide appropriate alternative text for meaningful images.
- Respect reduced-motion preferences.

---

## 14. Implementation Structure

Suggested component organization:

```text
src/
├── components/
│   ├── ui/                  # shadcn/ui primitives
│   ├── shared/              # Shared application components
│   ├── customer/            # Customer-specific components
│   ├── admin/               # Admin-specific components
│   └── staff/               # Staff-specific components
├── app/
└── styles/
    └── globals.css          # Global styles and design tokens
```

The exact folder structure must follow the existing project architecture. Do not restructure the application solely to match this example.

### Global Styling

- Define semantic CSS variables in the global stylesheet.
- Map design tokens to Tailwind and shadcn/ui conventions.
- Avoid hardcoding repeated color values.
- Support a consistent theme across all application surfaces.

### Component Ownership

- `ui/`: reusable low-level components.
- `shared/`: application-level components shared by multiple areas.
- `customer/`: components specific to customer ordering.
- `admin/`: components specific to administration.
- `staff/`: components specific to restaurant operations.

Do not duplicate components simply because they appear in different pages.

---

## 15. Design Quality Assurance

Before considering a UI feature complete, verify:

### Visual Consistency

- Uses approved color tokens.
- Uses consistent typography.
- Follows spacing and radius conventions.
- Uses consistent component variants.
- Maintains the intended visual direction.

### Responsive Behavior

- Works on mobile.
- Works on tablet.
- Works on desktop.
- Does not introduce horizontal overflow unintentionally.

### Interaction

- Buttons and controls work correctly.
- Loading states are implemented.
- Empty and error states are handled.
- Form validation is clear.
- Destructive actions require appropriate confirmation.

### Accessibility

- Labels are present.
- Focus states are visible.
- Contrast is sufficient.
- Status is not communicated through color alone.

### Regression Safety

- Existing business logic remains unchanged.
- Existing API contracts remain unchanged.
- Existing authorization behavior remains unchanged.
- Existing payment and order flows remain intact.

---

## 16. Design System Governance

This document is the single source of truth for the application's visual implementation.

When a new UI requirement is introduced:

1. Check whether an existing component or token can satisfy it.
2. Reuse existing patterns whenever practical.
3. Introduce a new component only when there is a genuine need.
4. Update this document when a design-system-level decision changes.
5. Avoid introducing inconsistent one-off styling.

Design improvements must not silently modify product requirements, business rules, database structures, or API contracts.

The design system may evolve as the application grows, but changes must remain intentional and consistent.
