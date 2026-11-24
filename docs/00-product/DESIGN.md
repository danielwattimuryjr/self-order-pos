# Design Direction — QR Restaurant Ordering System V1

## 1. Design Philosophy

QR Restaurant Ordering System uses a **Warm Minimalist** visual direction combined with a **Modern SaaS** interface for its management experience.

The design should feel:

- Modern and professional without looking overly corporate.
- Warm and welcoming without becoming overly decorative.
- Minimal but not empty or visually boring.
- Consistent across Customer, Admin, and Staff experiences.
- Practical for real restaurant operations.

The primary design objective is to create an attractive customer ordering experience while keeping administrative and operational workflows efficient.

### Design Principles

1. **Clarity over decoration** — Information must be easy to understand before adding visual decoration.
2. **Consistency over improvisation** — Components and patterns should follow the shared design system.
3. **Purpose-driven layouts** — Each interface should be designed around its user's primary tasks.
4. **Mobile-first for customers** — Customer ordering must work exceptionally well on mobile devices.
5. **Operational efficiency for staff** — Staff should be able to identify new tickets and find the required item information quickly.
6. **Progressive complexity** — Show important information first and secondary information when needed.

---

## 2. Visual Identity

### Overall Direction

The visual identity combines warm neutral surfaces, earthy orange accents, dark charcoal typography, subtle borders, and restrained shadows.

The interface should avoid:

- Excessive gradients.
- Excessive glassmorphism.
- Oversized decorative illustrations.
- Too many competing accent colors.
- Excessively rounded components.
- Unnecessary animations.
- Dense information layouts without clear hierarchy.

### Color Personality

The primary brand color is **Warm Terracotta**.

It should communicate warmth, appetite, friendliness, and confidence.

The overall interface uses:

- Warm off-white backgrounds.
- White surfaces for cards and content.
- Charcoal for primary text.
- Warm gray for secondary text.
- Terracotta for primary actions and brand emphasis.
- Semantic colors for system feedback and order statuses.

---

## 3. Customer Experience

### Design Goal

Create a frictionless food-ordering experience that encourages customers to explore the menu, customize their selections, and complete their orders.

The customer interface must prioritize the ordering journey rather than resemble a traditional administration dashboard.

### Layout Direction

- Mobile-first responsive layout.
- Minimal navigation.
- Clear restaurant identity and information.
- Prominent menu categories.
- Food photography as the primary visual element.
- Simple product cards.
- Persistent or easily accessible cart summary.
- Clear checkout and payment steps.

### Customer Interface Characteristics

**Restaurant Header**

- Restaurant logo or image.
- Restaurant name.
- Restaurant status.
- Relevant restaurant information.

**Menu Exploration**

- Category navigation using horizontal chips or tabs.
- Food items displayed as horizontal menu cards in a responsive list.
- Large and attractive food images.
- Menu name and price.
- Short description when available.
- Clear availability indication.

**Menu Details**

- Food image.
- Name and description.
- Price.
- Available variants and add-ons.
- Quantity selector.
- Special instructions where applicable.
- Clear add-to-cart action.

**Cart**

- Clear order summary.
- Editable item quantities.
- Selected variants and add-ons.
- Price breakdown.
- Prominent checkout action.

**Checkout and Payment**

- Simple and focused checkout layout.
- Transparent price breakdown.
- Clear payment instructions.
- Visible payment status.
- Clear success, pending, expired, and failed states.

### Customer UX Rules

- Avoid unnecessary navigation that interrupts the ordering flow.
- Do not force customers to navigate through an administration-style sidebar.
- Keep primary actions easy to reach on mobile.
- Preserve cart state during the ordering session.
- Use loading skeletons instead of sudden layout shifts.
- Provide clear empty, unavailable, and error states.

---

## 4. Admin Experience

### Design Goal

Provide a modern restaurant management dashboard that makes configuration, monitoring, and management tasks straightforward.

### Layout Direction

Use a Modern SaaS dashboard pattern.

**Main Layout**

- Persistent sidebar on desktop.
- Collapsible sidebar when appropriate.
- Responsive navigation on smaller screens.
- Top header containing page context and relevant actions.
- Main content area with consistent spacing.

**Dashboard**

- Compact summary cards.
- Important restaurant information.
- Relevant operational statistics.
- Recent activity or important records where applicable.
- Charts only when they provide meaningful information.

**Management Pages**

- Clear page titles and descriptions.
- Primary action positioned consistently.
- Search and filtering tools.
- Structured data tables.
- Pagination.
- Consistent create and edit forms.
- Confirmation dialogs for destructive operations.

### Admin UX Rules

- Prioritize frequently used information.
- Avoid unnecessary dashboard widgets.
- Keep CRUD operations consistent across modules.
- Use drawers or dialogs for focused operations when appropriate.
- Use full-page forms when the operation requires substantial input.
- Make destructive actions visually distinguishable.
- Display validation errors close to their respective fields.

---

## 5. Staff Experience

### Design Goal

Provide a read-only operational interface that lets Staff monitor paid kitchen tickets and find order details with minimal friction.

Staff uses the kitchen queue, order history, transaction/order details, and account profile. Staff does not process payments or change order state in the app.

The interface should prioritize ticket legibility and quick access to read-only information rather than management or analytics.

### Layout Direction

- Queue-first operational layout with active tickets and a separate history.
- Highly visible order cards.
- Easy-to-understand order details.
- Clear navigation and read-only detail links.
- Responsive layout for tablets and mobile devices.

### Order Interface

Each active ticket should prioritize:

- Order number.
- Table number and successful payment time.
- Ordered menu items.
- Quantities.
- Variants and add-ons.
- Item notes and customer name when available.
- A per-Staff-account `BARU` marker for tickets that account has not opened.

Active tickets must not display prices, discounts, payment methods, or other payment details. The history detail may show the full read-only historical order and payment information.

### Staff UX Rules

- Make new tickets immediately recognizable without presenting `BARU` as an order or payment status.
- Keep ticket details read-only; opening a ticket clears only that Staff account's `BARU` marker.
- Keep queue/history navigation and sound controls easy to reach.
- Use Realtime to refresh the queue, and communicate disconnection and reconnection states clearly.
- Provide loading and error feedback when retrieving ticket information.

---

## 6. Responsive Design

### Customer

Mobile-first is mandatory.

The ordering experience should adapt naturally to:

- Mobile phones.
- Tablets.
- Desktop browsers.

### Admin

Desktop-first, but responsive.

The dashboard should remain usable on:

- Desktop.
- Laptop.
- Tablet.
- Mobile when necessary.

### Staff

Tablet-friendly and mobile-responsive.

The interface must remain practical in a restaurant's operational environment.

---

## 7. Interaction and Motion

Animations should be subtle and purposeful.

Allowed examples:

- Button hover and active transitions.
- Dialog and drawer transitions.
- Cart updates.
- Skeleton loading.
- Small feedback animations.
- Toast notifications.

Avoid animations that slow down ordering or operational tasks.

Respect reduced-motion preferences.

---

## 8. Accessibility

- Maintain sufficient text and interactive-element contrast.
- Provide visible keyboard focus indicators.
- Use semantic HTML.
- Ensure form controls have accessible labels.
- Do not communicate status through color alone.
- Support keyboard navigation where applicable.
- Ensure interactive controls have practical touch targets.
- Respect reduced-motion preferences.

---

## 9. Design Consistency

All Customer, Admin, and Staff interfaces must share:

- Brand colors.
- Typography.
- Design tokens.
- Button styles.
- Form conventions.
- Status color semantics.
- Border and radius conventions.
- Interaction states.
- Feedback patterns.

However, each interface may use different layouts and component compositions according to its purpose.

---

## 10. Implementation Guidelines

- Use shadcn/ui as the foundation for reusable UI components.
- Use Tailwind CSS for styling.
- Use Lucide icons consistently.
- Centralize design tokens in the global stylesheet.
- Avoid arbitrary colors and spacing values when a design token exists.
- Customize shadcn/ui components to follow this design direction.
- Do not duplicate shared components unnecessarily.
- Keep Customer, Admin, and Staff-specific components separated where appropriate.
- Avoid changing business logic, API contracts, or database structures solely for visual improvements.

The design system documentation is defined in `DESIGN_SYSTEM.md`.

This document defines the visual direction. The design system defines the implementation rules.
