# Construction Management System (CMS) - Frontend

This is the frontend client for the Construction Management System, built with **Next.js**, **Tailwind CSS**, and **TypeScript**. It offers role-based client portals for project managers, contractors, and clients to interact with construction data in real-time.

## 🛠️ Tech Stack & Key Paradigms

* **Framework:** Next.js (App Router)
* **Styling:** Tailwind CSS & Shadcn UI
* **State Management:** TanStack Query (React Query) / Zustand
* **Authentication:** NextAuth.js
* **Rendering Strategies:** 
  * **SSR (Server-Side Rendering):** Used for secure, dynamic admin and project manager dashboards.
  * **ISR (Incremental Static Regeneration):** Used for public marketing, landing pages, and template documentation.
  * **CSR (Client-Side Rendering):** Used for highly interactive user actions like log forms and kanban filters.

## 🚀 Key Client Modules

* **Project Manager Dashboard:** Visual milestone timelines, financial budget forecasting widgets, and progress bars.
* **Contractor Site Portal:** Mobile-responsive layout for quick daily site logging, weather reporting, and inventory requests.
* **Client Portal:** Read-only interface featuring project schedules, visual image uploads of site progress, and billing invoices.

## ⚙️ Getting Started

### Prerequisites
* Node.js (v18.x or higher)
* npm, yarn, or pnpm

### Installation & Run

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your Environment Variables:
   Create a `.env.local` file in the root of this folder:
   ```env
   NEXT_PUBLIC_API_URL=http://localhost:5000/api/v1
   NEXTAUTH_SECRET=your_nextauth_secret_key
   ```

4. Run the local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the client app.
