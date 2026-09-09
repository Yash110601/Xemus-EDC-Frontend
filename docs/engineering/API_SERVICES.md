# API Services Library

> **Frontend-Only Application**  
> This is a Next.js frontend application that connects to a separate .NET Core 8 backend API.  
> All API calls are made to external backend endpoints. Mock mode is available for frontend-only development.

## Quick Start

### Basic Usage

```javascript
import { authService, userService, projectService } from '@/lib/services'

// Login
const response = await authService.login(username, password)
if (response.isSuccess) {
  // Handle success
}

// Create user
const userResponse = await userService.createUser(userData)

// Get projects
const projectsResponse = await projectService.getActiveProjects()
```

## Structure

```
lib/
├── api/                    # Core API infrastructure
│   ├── config.js          # Configuration
│   ├── client.js          # HTTP client
│   ├── interceptors.js    # Request/response interceptors
│   └── logger.js          # Logging
│
└── services/              # Business logic services
    ├── index.js           # Service exports
    ├── auth.service.js    # Authentication
    ├── user.service.js    # User management
    └── project.service.js # Project/study management
```

## Configuration

**Important:** This frontend connects to a separate .NET Core 8 backend API.

Set environment variables in `.env.local` (copy from `.env.example`):

```bash
cp .env.example .env.local
```

```env
# One-word switch: local | uat | prod
NEXT_PUBLIC_DEPLOY_TARGET=local
NEXT_PUBLIC_NER_API_KEY=<from team lead>
NEXT_PUBLIC_GEMINI_API_KEY=<from team lead>
```

UAT/PROD templates (no secrets): `deploy/env/uat.env.template`, `deploy/env/prod.env.template`

**Note:** When `NEXT_PUBLIC_MOCK_API=true`, the frontend uses mock data and doesn't require a backend. Set to `false` when your backend is ready.

## Documentation

- [Architecture](ARCHITECTURE.md) — complete architecture and usage guide
- [Docs index](../README.md) — all project documentation

## Features

✅ Modular, scalable architecture  
✅ Automatic retry with exponential backoff  
✅ Request timeout handling  
✅ Automatic token injection  
✅ Auto-logout on 401 errors  
✅ Comprehensive error handling  
✅ Mock mode for development  
✅ Centralized logging  
✅ Backward compatible  

