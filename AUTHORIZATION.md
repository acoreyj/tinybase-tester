# Schema Authorization System

This document describes the authorization system for TinyBase schemas, which allows you to define authorization rules at both the table and cell (field) level for CRUD operations.

## Overview

The authorization system allows you to:
- Define authorization requirements at the **table level** for entire tables
- Define authorization requirements at the **cell level** for individual fields
- Specify different authorization functions for each operation: **Create**, **Read**, **Update**, **Delete**
- Reference server-side authorization functions by name
- Validate operations on the server before they're executed

## Schema Definition

### Cell-Level Authorization

You can add authorization to individual fields using the `.authorize()` method:

```typescript
import { createSchema, text, datetime } from "@tinybase-tester/shared";

const productSchema = createSchema("product", {
  id: text().required(),
  
  // Only admins can update the product name
  name: text().required().authorize({ update: "isAdmin" }),
  
  // Admins required for create and update
  description: text().authorize({ 
    create: "isAdmin", 
    update: "isAdmin" 
  }),
  
  // Full authorization for all operations
  imageSet: text().authorize({ 
    create: "isAdmin",
    read: "isAuthenticated",
    update: "isAdmin", 
    delete: "isAdmin" 
  }),
  
  createdAt: datetime().defaultServerFunction("now", ["insert"]).readonly(),
});
```

### Table-Level Authorization

You can add authorization for entire tables by passing a fourth parameter to `createSchema`:

```typescript
const productSchema = createSchema(
  "product",
  {
    id: text().required(),
    name: text().required(),
  },
  undefined, // displayTemplate (optional)
  {
    // Table-level authorization
    create: "isAdmin",  // Only admins can create products
    delete: "isAdmin",  // Only admins can delete products
  }
);
```

### Combined Authorization

When both table-level and cell-level authorization are defined, both must pass for the operation to be allowed:

```typescript
const userSchema = createSchema(
  "user",
  {
    id: text().required(),
    username: text().authorize({ update: "isAdmin" }), // Cell-level
  },
  undefined,
  {
    delete: "isAdmin", // Table-level
  }
);
```

## Authorization Functions

Authorization functions are defined in `packages/shared/serverFunctions/authorization.ts`. The system comes with several built-in functions:

### Built-in Functions

- **`isAdmin`**: Checks if user has admin role
- **`isAuthenticated`**: Checks if user is authenticated
- **`isOwner`**: Checks if user owns the resource
- **`hasRole`**: Checks if user has a specific role
- **`allowAll`**: Always allows (useful for public resources)
- **`denyAll`**: Always denies

### Adding Custom Authorization Functions

You can add your own authorization functions:

```typescript
// In packages/shared/serverFunctions/authorization.ts
export const authorizationFunctions = {
  // ... existing functions ...
  
  isEditor: (context: AuthContext): boolean => {
    return context.userRole === "editor" || context.userRole === "admin";
  },
  
  canEditOwnProfile: (context: AuthContext, resourceOwnerId?: string): boolean => {
    return context.userId === resourceOwnerId || context.userRole === "admin";
  },
};
```

## Server-Side Usage

### Basic Authorization Check

```typescript
import { authChecker, type AuthContext } from "@tinybase-tester/shared";
import { productSchema } from "./schemas";

// Create auth context from user session
const authContext: AuthContext = {
  userId: "user-123",
  userRole: "admin",
  isAuthenticated: true,
};

// Check table-level authorization
const tableAuthResult = authChecker.checkTableAuthorization(
  "create",
  productSchema.tableAuthorization,
  authContext,
);

if (!tableAuthResult.authorized) {
  throw new Error(`Not authorized: ${tableAuthResult.reason}`);
}
```

### Validating Field Updates

```typescript
import { authChecker } from "@tinybase-tester/shared";

function validateProductUpdate(
  userContext: AuthContext,
  updates: Record<string, any>,
) {
  const tableName = Object.keys(productSchema.tinybaseSchema)[0];
  const schema = productSchema.schema.schema[tableName];
  
  // Validate each field being updated
  const authResults = authChecker.validateCells(
    "update",
    productSchema.tableAuthorization,
    Object.fromEntries(
      Object.keys(updates).map((fieldName) => [
        fieldName,
        schema[fieldName]?.authorization,
      ]),
    ),
    userContext,
  );
  
  // Check for failures
  const failedFields = Object.entries(authResults).filter(
    ([_, result]) => !result.authorized,
  );
  
  if (failedFields.length > 0) {
    throw new Error(
      `Not authorized to update: ${failedFields.map(([name]) => name).join(", ")}`
    );
  }
}
```

### Filtering Read Operations

```typescript
function readProductWithFiltering(
  userContext: AuthContext,
  productData: Record<string, any>,
) {
  const tableName = Object.keys(productSchema.tinybaseSchema)[0];
  const schema = productSchema.schema.schema[tableName];
  
  const filteredProduct: Record<string, any> = {};
  
  for (const [fieldName, value] of Object.entries(productData)) {
    const fieldConfig = schema[fieldName];
    const authResult = authChecker.checkCellAuthorization(
      "read",
      fieldConfig?.authorization,
      userContext,
    );
    
    if (authResult.authorized) {
      filteredProduct[fieldName] = value;
    }
  }
  
  return filteredProduct;
}
```

## Integration with TinyBase Server

In your Durable Object or server handler, you can integrate authorization checks:

```typescript
// In packages/tinybase-server/src/statestore.ts
import { authChecker, type AuthContext } from "@tinybase-tester/shared";

async onMessageMutator(
  fromClientId: Id,
  toClientId: Id,
  remainder: string,
): Promise<boolean> {
  const diffs = getTableDiffs(data, this.store!);
  
  // Get user context from session/token
  const userContext = await this.getUserContext(fromClientId);
  
  // Validate each mutation
  for (const diff of diffs) {
    const schema = this.getSchemaForTable(diff.table);
    
    if (diff.update) {
      // Check update authorization
      const authResult = authChecker.checkAuthorization(
        "update",
        schema.tableAuthorization,
        schema.schema.schema[diff.table][diff.field]?.authorization,
        userContext,
      );
      
      if (!authResult.authorized) {
        // Reject the mutation
        this.sendErrorToClient(fromClientId, authResult.reason);
        return false;
      }
    }
  }
  
  return true; // Allow the mutation
}
```

## Auth Context

The `AuthContext` object contains information about the current user:

```typescript
type AuthContext = {
  userId?: string;           // User's unique ID
  userRole?: string;        // User's role (e.g., "admin", "user")
  isAuthenticated: boolean; // Whether user is authenticated
  [key: string]: any;       // Additional custom properties
};
```

You can extend this with additional properties as needed for your application.

## Best Practices

1. **Principle of Least Privilege**: Only grant the minimum permissions needed
2. **Default Deny**: If no authorization is specified, the operation is allowed. Consider explicitly setting authorization on sensitive fields
3. **Layer Authorization**: Use both table-level and cell-level authorization for sensitive data
4. **Validate on Server**: Always validate authorization on the server, never trust client-side checks
5. **Audit Logging**: Log authorization failures for security monitoring

## Example Schemas

### Admin-Only Product Management

```typescript
export const productSchema = createSchema(
  "product",
  {
    id: text().required(),
    name: text().required().authorize({ update: "isAdmin" }),
    description: text().authorize({ create: "isAdmin", update: "isAdmin" }),
    price: number().authorize({ create: "isAdmin", update: "isAdmin" }),
  },
  undefined,
  {
    create: "isAdmin",
    delete: "isAdmin",
  },
);
```

### User Profile with Owner Permissions

```typescript
export const userProfileSchema = createSchema(
  "userProfile",
  {
    id: text().required(),
    username: text().required(),
    email: text().authorize({ 
      read: "isOwner",
      update: "isOwner" 
    }),
    bio: text().authorize({ update: "isOwner" }),
  },
);
```

### Public Read, Admin Write

```typescript
export const blogPostSchema = createSchema(
  "blogPost",
  {
    id: text().required(),
    title: text().required().authorize({ 
      create: "isAdmin",
      update: "isAdmin" 
    }),
    content: text().authorize({ 
      create: "isAdmin",
      update: "isAdmin" 
    }),
    publishedAt: datetime(),
  },
  undefined,
  {
    create: "isAdmin",
    update: "isAdmin",
    delete: "isAdmin",
  },
);
```

## Troubleshooting

### Authorization Function Not Found

If you see an error like "Authorization function 'xyz' not found", make sure:
1. The function is defined in `packages/shared/serverFunctions/authorization.ts`
2. It's exported in the `authorizationFunctions` object
3. The name in your schema exactly matches the function name

### Authorization Always Failing

Check that:
1. Your `AuthContext` is being created correctly with the right user data
2. The authorization function is receiving the correct context
3. The function logic is correct

### Type Errors

If you get TypeScript errors:
1. Make sure you've imported the types: `import type { AuthContext } from "@tinybase-tester/shared"`
2. Rebuild the shared package if you've made changes
3. Check that your authorization function names are strings, not variables
