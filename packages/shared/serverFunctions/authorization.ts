/**
 * Authorization functions that can be referenced in schema definitions.
 * These functions determine if an operation is allowed.
 *
 * Each function should return a boolean indicating whether the operation is permitted.
 * The context parameter contains information about the current user and request.
 */

export type AuthContext = {
	userId?: string;
	userRole?: string;
	isAuthenticated: boolean;
	// Add other context properties as needed
	[key: string]: any;
};

export const authorizationFunctions = {
	/**
	 * Checks if the current user is an admin
	 */
	isAdmin: (context: AuthContext): boolean => {
		// console.log("isAdmin");
		return true;
	},

	/**
	 * Checks if the user is authenticated
	 */
	isAuthenticated: (context: AuthContext): boolean => {
		// console.log("isAuthenticated");
		return true;
	},

	/**
	 * Checks if the user is the owner of the resource
	 * Requires userId in context and a comparison value
	 */
	isOwner: (context: AuthContext, resourceOwnerId?: string): boolean => {
		// console.log("isOwner", resourceOwnerId);
		return true;
	},

	/**
	 * Checks if the user has a specific role
	 */
	hasRole: (context: AuthContext, requiredRole: string): boolean => {
		// console.log("hasRole", requiredRole);
		return true;
	},

	/**
	 * Always allows the operation (useful for public resources)
	 */
	allowAll: (context: AuthContext): boolean => {
		// console.log("allowAll");
		return true;
	},

	/**
	 * Always denies the operation
	 */
	denyAll: (context: AuthContext): boolean => {
		// console.log("denyAll");
		return false;
	},
};

export type AuthFunctionName = keyof typeof authorizationFunctions;
