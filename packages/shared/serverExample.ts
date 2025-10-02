/**
 * Example of how to use authorization in your server code
 * This file demonstrates best practices for implementing authorization checks
 */

import { authChecker, type AuthContext } from "./authorizationChecker";
import {
	productSchema,
	getUserSchema,
} from "../astro/src/utils/tinybase/tinybaseSchemas";

/**
 * Example: Checking authorization before a create operation
 */
export function exampleCreateProduct(
	userContext: AuthContext,
	productData: any,
) {
	const tableName = Object.keys(productSchema.tinybaseSchema)[0];
	const tableAuth = productSchema.tableAuthorization;

	// Check table-level create authorization
	const tableAuthResult = authChecker.checkTableAuthorization(
		"create",
		tableAuth,
		userContext,
	);

	if (!tableAuthResult.authorized) {
		throw new Error(
			`Not authorized to create ${tableName}: ${tableAuthResult.reason}`,
		);
	}

	// Check field-level authorization for each field being set
	const schema = productSchema.schema.schema[tableName];

	for (const [fieldName, value] of Object.entries(productData)) {
		const fieldConfig = schema[fieldName];
		if (fieldConfig?.authorization) {
			const cellAuthResult = authChecker.checkCellAuthorization(
				"create",
				fieldConfig.authorization,
				userContext,
			);

			if (!cellAuthResult.authorized) {
				throw new Error(
					`Not authorized to create field ${fieldName}: ${cellAuthResult.reason}`,
				);
			}
		}
	}

	// If we get here, all authorization checks passed
	console.log("Authorization checks passed, proceeding with create");
	// ... proceed with actual creation
}

/**
 * Example: Checking authorization before an update operation
 */
export function exampleUpdateProduct(
	userContext: AuthContext,
	productId: string,
	updates: Record<string, any>,
) {
	const tableName = Object.keys(productSchema.tinybaseSchema)[0];
	const tableAuth = productSchema.tableAuthorization;
	const schema = productSchema.schema.schema[tableName];

	// For each field being updated, check authorization
	const authResults = authChecker.validateCells(
		"update",
		tableAuth,
		Object.fromEntries(
			Object.keys(updates).map((fieldName) => [
				fieldName,
				schema[fieldName]?.authorization,
			]),
		),
		userContext,
	);

	// Check if any field failed authorization
	const failedFields = Object.entries(authResults).filter(
		([_, result]) => !result.authorized,
	);

	if (failedFields.length > 0) {
		const failedFieldNames = failedFields
			.map(([fieldName, result]) => `${fieldName} (${result.reason})`)
			.join(", ");
		throw new Error(`Not authorized to update fields: ${failedFieldNames}`);
	}

	console.log("Authorization checks passed, proceeding with update");
	// ... proceed with actual update
}

/**
 * Example: Checking authorization for delete
 */
export function exampleDeleteUser(userContext: AuthContext, userId: string) {
	const userSchema = getUserSchema(userId);
	const tableAuth = userSchema.tableAuthorization;

	const authResult = authChecker.checkTableAuthorization(
		"delete",
		tableAuth,
		userContext,
	);

	if (!authResult.authorized) {
		throw new Error(`Not authorized to delete user: ${authResult.reason}`);
	}

	console.log("Authorization check passed, proceeding with delete");
	// ... proceed with actual deletion
}

/**
 * Example: Checking authorization for read with filtered fields
 */
export function exampleReadProduct(
	userContext: AuthContext,
	productId: string,
) {
	const tableName = Object.keys(productSchema.tinybaseSchema)[0];
	const schema = productSchema.schema.schema[tableName];

	// Simulate reading the product
	const productData = {
		id: productId,
		name: "Sample Product",
		description: "Sample Description",
		imageSet: "image-url",
	};

	// Filter out fields the user doesn't have read access to
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
		} else {
			console.log(`Field ${fieldName} filtered due to: ${authResult.reason}`);
		}
	}

	return filteredProduct;
}

/**
 * Example: Creating a user context from a request
 */
export function createAuthContext(
	userId?: string,
	userRole?: string,
): AuthContext {
	return {
		userId,
		userRole,
		isAuthenticated: !!userId,
	};
}

// Example usage:
export function exampleUsage() {
	// Admin user
	const adminContext = createAuthContext("admin-123", "admin");

	// Regular user
	const userContext = createAuthContext("user-456", "user");

	// Try to create a product as admin (should succeed)
	try {
		exampleCreateProduct(adminContext, {
			id: "prod-1",
			name: "New Product",
			description: "A new product",
		});
		console.log("✓ Admin created product");
	} catch (error) {
		console.error("✗ Admin failed to create product:", error);
	}

	// Try to create a product as regular user (should fail)
	try {
		exampleCreateProduct(userContext, {
			id: "prod-2",
			name: "Another Product",
			description: "Another product",
		});
		console.log("✓ User created product");
	} catch (error) {
		console.error("✗ User failed to create product:", error);
	}

	// Try to update product description as regular user (should fail for certain fields)
	try {
		exampleUpdateProduct(userContext, "prod-1", {
			name: "Updated Name", // Requires isAdmin
		});
		console.log("✓ User updated product");
	} catch (error) {
		console.error("✗ User failed to update product:", error);
	}

	// Read product with filtering
	const filteredProduct = exampleReadProduct(userContext, "prod-1");
	console.log("Filtered product for user:", filteredProduct);
}
