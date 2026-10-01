# ManageOPD Frontend (`manageopd-fe`)

This directory contains the user interface for the ManageOPD application. It is a single-page application (SPA) built to deliver a premium, modern, and highly responsive experience.

## Technology Stack
- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: TailwindCSS (v3) + PostCSS
- **Routing**: `react-router-dom`
- **State Management**: Zustand (for lightweight global state, e.g., UI selections)
- **Icons**: `lucide-react`
- **HTTP Client**: Axios (configured in `src/lib/api.ts` with interceptors for auth cookies)

## Architecture & Layouts

The application essentially serves two primary flows separated by top-level routes:
1. **Public/Auth Shell (`src/App.tsx`)**: Contains the Landing Page, Login, Signup, Reset Password, and Email Verification logic.
2. **Workspace Shell (`src/pages/Workspace.tsx`)**: The core application. A unified shell that dynamically mounts distinct views based on the authenticated user's `role`.

### Role-Based Rendering in Workspace
The `WorkspaceRouter` inside `Workspace.tsx` reads the `user.role` from the API `/auth/me/` and returns one of three components:
- `<ReceptionDesk />`: Front desk operations (Queue, Patients, Booking).
- `<DoctorWorkspace />`: Clinical operations (Queue, Symptom Summaries, Patient Charts).
- `<AdminConsole />`: Management operations (Analytics, Reporting, Team Management).

## Component Design
The `src/components/ui` folder contains reusable atoms that power the unified aesthetic:
- **`Button.tsx`**: Dynamic variants (primary, secondary, danger) with loading states.
- **`Card.tsx`**: A fundamental layout wrapper with soft shadows and borders for the "glassmorphism" feel.
- **`PasswordInput.tsx`**: Includes live inline validation checking for strong passwords.
- **`PhoneInput.tsx`**: Custom country code selector with international standard support.
- **`AmPmTimePicker.tsx`**: Translates user-friendly 12-hour AM/PM interactions into strict 24-hour HH:mm strings for backend compliance.
- **`DateTimePickerAmPm.tsx`**: An intuitive replacement for native `datetime-local` inputs.

## State & API
- API calls are structured inside local component functions using `async/await`.
- We utilize `Promise.allSettled()` for robust dashboard loading (e.g., in `DoctorWorkspace`) so that if one API endpoint fails, the rest of the widgets continue to load successfully.
- Cross-component state (like the currently selected patient in the drawer) is managed via `useUIStore` inside `src/store/uistore.ts`.

## Styling Conventions
The UI is strictly designed with Vanilla TailwindCSS utility classes. We prioritize:
- Slate and Emerald color palettes for a clinical yet modern aesthetic.
- Subtle `transition-all` animations on interactive elements.
- Full responsiveness, utilizing `grid` and `md:grid-cols-*` to snap widgets smoothly across mobile and desktop.
