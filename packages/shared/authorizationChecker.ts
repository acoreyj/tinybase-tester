import type {
	AuthOperation,
	AuthorizationConfig,
	TableAuthorizationConfig,
} from "./schemaCreator";
import type { AuthContext } from "./serverFunctions/authorization";
import { serverFunctions } from "./serverFunctions";

/**
 * Utility class to check authorization based on schema configuration
 */
export class AuthorizationChecker {
	private authFunctions = serverFunctions.authorization;

	/**
	 * Check if a table operation is authorized
	 */
	checkTableAuthorization(
		operation: AuthOperation,
		tableAuth: TableAuthorizationConfig | undefined,
		context: AuthContext,
	): { authorized: boolean; reason?: string } {
		if (!tableAuth) {
			// No authorization configured means allow all
			return { authorized: true };
		}

		const authFunctionName = tableAuth[operation];
		if (!authFunctionName) {
			// No specific authorization for this operation means allow
			return { authorized: true };
		}

		const authFunction =
			this.authFunctions[authFunctionName as keyof typeof this.authFunctions];
		if (!authFunction) {
			return {
				authorized: false,
				reason: `Authorization function '${authFunctionName}' not found`,
			};
		}

		const authorized = authFunction(context);
		return {
			authorized,
			reason: authorized
				? undefined
				: `Authorization function '${authFunctionName}' denied access`,
		};
	}

	/**
	 * Check if a cell operation is authorized
	 */
	checkCellAuthorization(
		operation: AuthOperation,
		cellAuth: AuthorizationConfig | undefined,
		context: AuthContext,
	): { authorized: boolean; reason?: string } {
		if (!cellAuth) {
			// No authorization configured means allow all
			return { authorized: true };
		}

		const authFunctionName = cellAuth[operation];
		if (!authFunctionName) {
			// No specific authorization for this operation means allow
			return { authorized: true };
		}

		const authFunction =
			this.authFunctions[authFunctionName as keyof typeof this.authFunctions];
		if (!authFunction) {
			return {
				authorized: false,
				reason: `Authorization function '${authFunctionName}' not found`,
			};
		}

		const authorized = authFunction(context);
		return {
			authorized,
			reason: authorized
				? undefined
				: `Authorization function '${authFunctionName}' denied access`,
		};
	}

	/**
	 * Check if an operation on a specific cell is authorized
	 * Checks both table-level and cell-level authorization
	 */
	checkAuthorization(
		operation: AuthOperation,
		tableAuth: TableAuthorizationConfig | undefined,
		cellAuth: AuthorizationConfig | undefined,
		context: AuthContext,
	): { authorized: boolean; reason?: string } {
		// Check table-level authorization first
		const tableCheck = this.checkTableAuthorization(
			operation,
			tableAuth,
			context,
		);
		if (!tableCheck.authorized) {
			return tableCheck;
		}

		// Then check cell-level authorization
		return this.checkCellAuthorization(operation, cellAuth, context);
	}

	/**
	 * Validate multiple cells at once for an operation
	 * Returns a map of field names to authorization results
	 */
	validateCells(
		operation: AuthOperation,
		tableAuth: TableAuthorizationConfig | undefined,
		cellsAuth: Record<string, AuthorizationConfig | undefined>,
		context: AuthContext,
	): Record<string, { authorized: boolean; reason?: string }> {
		const results: Record<string, { authorized: boolean; reason?: string }> =
			{};

		for (const [fieldName, cellAuth] of Object.entries(cellsAuth)) {
			results[fieldName] = this.checkAuthorization(
				operation,
				tableAuth,
				cellAuth,
				context,
			);
		}

		return results;
	}
}

/**
 * Create a singleton instance for convenience
 */
export const authChecker = new AuthorizationChecker();
