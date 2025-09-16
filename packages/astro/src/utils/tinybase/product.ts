export const getProductId = (pathname: string, title: string) => {
	const slug = pathname.split("/").pop() || "product";
	return `${slug}-_-${title.toLowerCase().replace(/[^a-z0-9]/g, "-")}`;
};
