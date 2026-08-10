# Construction Operations SaaS

## 1. Product Overview

Construction Operations SaaS is a multi-tenant SaaS platform designed to help construction companies manage their projects and daily operations from a centralized system.

The platform will help companies manage:

- Construction projects
- Project teams
- Workers
- Tasks
- Daily work reports
- Materials and inventory
- Expenses and budgets
- Construction issues
- Project documents
- Notifications
- Project progress
- Analytics

The goal is to provide construction companies with a single platform for managing project operations.

---

## 2. Target Users

The initial target customers are small and medium-sized construction companies.

The platform should support multiple companies.

Each company must have isolated data.

One company's users must never be able to access another company's data.

---

## 3. User Roles

### ADMIN

The company administrator can:

- Manage company information
- Invite and manage users
- Assign roles
- Create and manage projects
- View company-wide information
- Manage permissions
- View analytics
- Manage company settings

### PROJECT_MANAGER

A project manager can:

- Create projects
- Update projects
- Assign team members
- Create tasks
- Assign tasks
- Review daily work reports
- Manage project expenses
- Monitor project progress
- Manage project issues
- View project analytics
- Upload and manage project documents

### ENGINEER

An engineer can:

- View assigned projects
- View project information
- Manage assigned technical tasks
- Submit daily work reports
- Report construction issues
- Update task progress
- Upload project documents
- Add technical notes

### WORKER

A worker can:

- View assigned projects
- View assigned tasks
- Update task status
- Submit work information
- View relevant project information

Workers should only access information necessary for their assigned work.

---

## 4. Core Modules

### 4.1 Authentication

The system should support:

- User registration
- Login
- Logout
- Authentication
- Session management
- Password hashing
- Protected routes
- Role-based authorization

Authentication should use secure HTTP-only cookies.

---

### 4.2 Company Management

Each company should have:

- Company name
- Logo
- Contact information
- Address
- Created date
- Updated date

A company can have multiple users and projects.

---

### 4.3 Project Management

A project should contain:

- Project name
- Description
- Location
- Client information
- Start date
- Expected end date
- Actual end date
- Budget
- Status
- Progress percentage
- Project manager

Possible project statuses:

- PLANNING
- ACTIVE
- ON_HOLD
- COMPLETED
- CANCELLED

---

### 4.4 Project Team

Project managers should be able to assign users to projects.

A project can have multiple team members.

A user can participate in multiple projects.

Project membership should include:

- User
- Project
- Role within project
- Assigned date

---

### 4.5 Task Management

Users with appropriate permissions can create tasks.

A task should contain:

- Title
- Description
- Project
- Assigned user
- Priority
- Status
- Start date
- Due date
- Completion date

Task statuses:

- TODO
- IN_PROGRESS
- BLOCKED
- REVIEW
- COMPLETED

Task priorities:

- LOW
- MEDIUM
- HIGH
- URGENT

---

### 4.6 Daily Work Reports

Workers and engineers should be able to submit daily work reports.

A report may contain:

- Project
- Date
- Submitted by
- Workers involved
- Work completed
- Hours worked
- Materials used
- Progress percentage
- Problems encountered
- Notes
- Photos or attachments

Project managers should be able to review submitted reports.

---

### 4.7 Material Management

The system should track construction materials such as:

- Cement
- Steel
- Bricks
- Sand
- Cable
- Pipes
- Paint
- Tiles

The system should support:

- Material creation
- Inventory tracking
- Material purchases
- Material usage
- Stock adjustments
- Low-stock alerts

Each inventory transaction should maintain an auditable history.

---

### 4.8 Expense and Budget Management

Projects should have budgets.

Expenses may include:

- Materials
- Labor
- Transportation
- Equipment
- Other expenses

The system should track:

- Estimated budget
- Actual expenses
- Remaining budget
- Expense categories
- Expense date
- Amount
- Description
- Submitted by
- Approval status

Possible expense statuses:

- PENDING
- APPROVED
- REJECTED

---

### 4.9 Construction Issues

Users should be able to report construction issues.

An issue should contain:

- Title
- Description
- Project
- Location
- Priority
- Reporter
- Assigned user
- Status
- Resolution
- Created date
- Resolved date

Possible issue statuses:

- OPEN
- ASSIGNED
- IN_PROGRESS
- RESOLVED
- VERIFIED
- CLOSED

---

### 4.10 Document Management

Projects should support documents such as:

- Blueprints
- Contracts
- Invoices
- Reports
- Certificates
- Safety documents
- Work photos

Documents should have appropriate access permissions.

---

### 4.11 Notifications

The system should notify users about important events.

Examples:

- Task assigned
- Task deadline approaching
- New daily report
- New construction issue
- Expense requiring approval
- Low material stock
- New project assignment
- Document uploaded

The initial notification system can be database-based.

Real-time notifications can be added later.

---

### 4.12 Dashboard and Analytics

The system should provide dashboards based on user role.

Project dashboard may show:

- Project progress
- Budget
- Actual expenses
- Remaining budget
- Tasks
- Completed tasks
- Open issues
- Material stock
- Recent reports

Company dashboard may show:

- Total projects
- Active projects
- Completed projects
- Total budget
- Total expenses
- Team members
- Project performance

---

## 5. Multi-Tenant Architecture

The platform is a multi-tenant SaaS application.

A company represents a tenant.

Every company-owned resource must be associated with a company.

Examples:

- Projects belong to companies
- Users belong to companies
- Tasks belong to projects
- Expenses belong to projects
- Materials belong to companies/projects

The backend must always verify company ownership before allowing access to resources.

Cross-company data access must never be allowed.

---

## 6. Technology Stack

### Frontend

- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend

- Node.js
- Express.js
- TypeScript
- Zod

### Database

- PostgreSQL
- Prisma ORM

### Authentication

- JWT
- HTTP-only cookies
- Password hashing
- Role-based access control

### Future

- Socket.IO
- Docker
- GitHub Actions
- Cloud file storage
- Automated testing
- Production monitoring

---

## 7. Core Business Workflows

### Project Workflow

PLANNING → ACTIVE → ON_HOLD → COMPLETED

A project may also be CANCELLED.

### Task Workflow

TODO → IN_PROGRESS → REVIEW → COMPLETED

A task may become BLOCKED.

### Issue Workflow

OPEN → ASSIGNED → IN_PROGRESS → RESOLVED → VERIFIED → CLOSED

### Expense Workflow

PENDING → APPROVED

or

PENDING → REJECTED

### Inventory Workflow

Purchase → Stock Increase

Material Usage → Stock Decrease

Stock Adjustment → Auditable Change

---

## 8. Security Requirements

The application must:

- Hash passwords securely
- Use HTTP-only authentication cookies
- Validate incoming data with Zod
- Enforce role-based authorization
- Enforce company-level authorization
- Prevent unauthorized resource access
- Protect sensitive environment variables
- Validate file uploads
- Use secure CORS configuration
- Implement consistent error handling
- Avoid exposing sensitive information in API responses

---

## 9. API Requirements

The backend will provide REST APIs.

API responsibilities include:

- Authentication
- Company management
- User management
- Project management
- Project membership
- Task management
- Daily reports
- Materials
- Inventory
- Expenses
- Issues
- Documents
- Notifications
- Analytics

The API should use consistent response formats and HTTP status codes.

---

## 10. Development Principles

The project should follow:

- TypeScript strict mode
- Clean architecture
- Separation of concerns
- Reusable components
- Reusable backend services
- Centralized error handling
- Centralized validation
- Secure authorization
- Database integrity
- Meaningful naming
- Minimal dependencies
- Maintainable code
- Production-oriented practices

---

## 11. Initial Development Phases

### Phase 1
Product requirements and architecture

### Phase 2
Repository and project setup

### Phase 3
Database schema and Prisma

### Phase 4
Express backend foundation

### Phase 5
Authentication and authorization

### Phase 6
Company management

### Phase 7
Project management

### Phase 8
Project team management

### Phase 9
Task management

### Phase 10
Daily work reports

### Phase 11
Material and inventory management

### Phase 12
Expense and budget management

### Phase 13
Issue management

### Phase 14
Document management

### Phase 15
Notifications

### Phase 16
Dashboards and analytics

### Phase 17
Testing

### Phase 18
Docker

### Phase 19
CI/CD

### Phase 20
Production deployment

---

## 12. MVP Principle

We should not build every feature at once.

The first MVP should focus on:

1. Authentication
2. Company management
3. Project management
4. Project members
5. Task management
6. Basic dashboard

After the MVP works correctly, additional modules will be added incrementally.