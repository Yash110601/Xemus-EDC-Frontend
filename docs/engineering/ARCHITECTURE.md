# API Architecture Documentation

## Overview

> **Frontend-Only Application**  
> This is a Next.js frontend application that connects to a separate .NET Core 8 backend API.  
> The frontend makes HTTP requests to external backend endpoints. Mock mode allows development without a backend.

This document describes the professional, scalable API architecture for the PR EDC Frontend application. The architecture is designed to support large-scale applications with modular, maintainable, and extensible code.

## Directory Structure

```
lib/
├── api/                          # Core API infrastructure
│   ├── config.js                 # API configuration (endpoints, timeouts, etc.)
│   ├── client.js                 # Enhanced HTTP client with retry logic
│   ├── interceptors.js           # Request/response interceptors
│   └── logger.js                 # Centralized logging
│
├── services/                     # Business logic services
│   ├── index.js                  # Service exports
│   ├── auth.service.js           # Authentication service
│   ├── user.service.js           # User management service
│   ├── project.service.js        # Project/study service
│   └── [future services...]      # Additional services as needed
│
├── services.js                   # Main entry point (backward compatibility)
├── README.md                      # Quick start guide
├── BACKEND_API_REQUIREMENTS.md   # Backend API specifications
└── (see docs/engineering/ARCHITECTURE.md)
```

## Core Components

### 1. API Configuration (`api/config.js`)

Centralized configuration for all API-related settings:

- **Base URL**: Configured via environment variables
- **Endpoints**: All API endpoints defined in one place
- **Timeouts**: Request timeout configuration
- **Retry Logic**: Maximum retries and retry delays
- **Mock Mode**: Enable/disable mock data for development

**Usage:**
```javascript
import { API_CONFIG } from '@/lib/api/config'

const endpoint = API_CONFIG.ENDPOINTS.USER.CREATE
```

### 2. API Client (`api/client.js`)

Enhanced HTTP client with professional features:

- **Automatic Retry**: Exponential backoff retry logic
- **Request Timeout**: Configurable timeout with AbortController
- **Error Handling**: Comprehensive error handling and formatting
- **Request Interceptors**: Automatic token injection
- **Response Interceptors**: Automatic error handling (401, 403, 500+)
- **Logging**: Integrated logging for debugging

**Features:**
- Retries failed requests (network errors, 5xx errors)
- Exponential backoff for retries
- Request cancellation on timeout
- Standardized response format

### 3. Interceptors (`api/interceptors.js`)

Request and response interceptors for cross-cutting concerns:

- **Request Interceptor**: Adds authentication tokens, timestamps
- **Response Interceptor**: Handles 401 (auto-logout), 403, 500+ errors
- **Error Interceptor**: Formats errors consistently

### 4. Logger (`api/logger.js`)

Centralized logging system:

- **Log Levels**: DEBUG, INFO, WARN, ERROR
- **Request/Response Logging**: Automatic logging of API calls
- **Configurable**: Enable/disable via environment variable

### 5. Services (`services/*.service.js`)

Business logic services organized by domain:

- **auth.service.js**: Authentication, login, logout, token management
- **user.service.js**: User CRUD operations
- **project.service.js**: Project/study management
- **Future services**: Can be added as needed

Each service:
- Uses the API client
- Handles mock mode
- Provides consistent error handling
- Includes logging

## Usage Patterns

### Pattern 1: Import from Main Entry Point (Backward Compatible)

```javascript
import { authService, userService, apiClient } from '@/lib/services'
```

### Pattern 2: Import from Services Index (Recommended)

```javascript
import { authService, userService, apiClient } from '@/lib/services/index'
```

### Pattern 3: Import Specific Service (Best for Tree Shaking)

```javascript
import authService from '@/lib/services/auth.service'
import userService from '@/lib/services/user.service'
```

### Pattern 4: Import Configuration

```javascript
import { API_CONFIG, STORAGE_KEYS, HTTP_STATUS } from '@/lib/api/config'
```

## Adding a New Service

### Step 1: Create Service File

Create `lib/services/your-service.service.js`:

```javascript
import apiClient from "../api/client"
import { API_CONFIG } from "../api/config"
import logger from "../api/logger"

class YourService {
  async getData() {
    try {
      return await apiClient.get(API_CONFIG.ENDPOINTS.YOUR_SERVICE.BASE)
    } catch (error) {
      logger.error("Get data failed", error)
      return {
        isSuccess: false,
        statusCode: 500,
        data: null,
        message: error.message || "Failed to get data",
      }
    }
  }
}

export default new YourService()
```

### Step 2: Add Endpoint to Config

Update `lib/api/config.js`:

```javascript
ENDPOINTS: {
  // ... existing endpoints
  YOUR_SERVICE: {
    BASE: "/your-service",
    BY_ID: (id) => `/your-service/${id}`,
  },
}
```

### Step 3: Export from Services Index

Update `lib/services/index.js`:

```javascript
export { default as yourService } from "./your-service.service"
```

### Step 4: Export from Main Services (Optional)

Update `lib/services.js` for backward compatibility:

```javascript
export { default as yourService } from "./services/your-service.service"
```

## Environment Variables

Create `.env.local`:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:5000/api
NEXT_PUBLIC_API_VERSION=v1
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_API_MAX_RETRIES=3
NEXT_PUBLIC_API_RETRY_DELAY=1000

# Mock Mode
NEXT_PUBLIC_MOCK_API=true

# Logging
NEXT_PUBLIC_API_LOGGING=false
```

## Response Format

All API responses follow this standardized format:

```typescript
{
  isSuccess: boolean
  statusCode: number
  data: any | null
  message: string
  httpStatus: number
}
```

## Error Handling

### Automatic Error Handling

- **401 Unauthorized**: Automatically logs out user and redirects to login
- **403 Forbidden**: Logs warning (permissions issue)
- **500+ Server Errors**: Logs error with details
- **Network Errors**: Returns formatted error response
- **Timeouts**: Returns timeout error

### Manual Error Handling

```javascript
const response = await userService.createUser(data)

if (!response.isSuccess) {
  // Handle error
  console.error(response.message)
  // Show user-friendly error message
}
```

## Mock Mode

Mock mode allows frontend development without a backend:

1. Set `NEXT_PUBLIC_MOCK_API=true` in `.env.local`
2. Services return mock data instead of making API calls
3. Useful for:
   - UI development
   - Testing
   - Demos
   - When backend is not ready

## Best Practices

1. **Use Service Classes**: Always use service classes, never call `apiClient` directly from components
2. **Error Handling**: Always check `response.isSuccess` before using data
3. **Loading States**: Show loading indicators during API calls
4. **User Feedback**: Display success/error messages to users
5. **Logging**: Use logger for debugging (disabled in production by default)
6. **Type Safety**: Consider adding TypeScript for better type safety
7. **Testing**: Write unit tests for services
8. **Documentation**: Document complex service methods

## Migration Guide

### From Old Structure to New Structure

**Old:**
```javascript
import { authService } from '@/lib/services'
```

**New (Same - Backward Compatible):**
```javascript
import { authService } from '@/lib/services'
```

**New (Recommended):**
```javascript
import { authService } from '@/lib/services/index'
// or
import authService from '@/lib/services/auth.service'
```

## Performance Considerations

1. **Request Cancellation**: AbortController cancels requests on timeout
2. **Retry Logic**: Exponential backoff prevents server overload
3. **Logging**: Disabled by default in production
4. **Tree Shaking**: Import specific services for smaller bundle size

## Security Considerations

1. **Token Storage**: Tokens stored in localStorage (consider httpOnly cookies for production)
2. **Auto-Logout**: 401 responses automatically log out users
3. **HTTPS**: Always use HTTPS in production
4. **CORS**: Configure CORS properly on backend

## Future Enhancements

- [ ] Request/Response caching
- [ ] Request queuing
- [ ] Offline support
- [ ] Request deduplication
- [ ] TypeScript migration
- [ ] Service worker integration
- [ ] GraphQL support (if needed)

## Support

For questions or issues:
1. Check `API_MANAGEMENT_GUIDE.md` for usage examples
2. Check `BACKEND_API_REQUIREMENTS.md` for backend specifications
3. Review service files for implementation examples

