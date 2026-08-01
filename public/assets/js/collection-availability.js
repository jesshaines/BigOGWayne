export function getProductsFromResponse(json) {
  if (Array.isArray(json)) return json;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.products)) return json.products;
  return [];
}

export function slugify(value = "") {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function splitProductTitle(product = {}) {
  const title = String(product.title || product.name || "").trim();
  const titleMatch = title.match(/^(.+?)\s+[—–-]\s+(.+)$/);

  return {
    collectionName: titleMatch ? titleMatch[1].trim() : "",
    productTypeText: titleMatch ? titleMatch[2].trim() : title
  };
}

export function inferProductCollection(product = {}) {
  const { collectionName } = splitProductTitle(product);
  if (!collectionName) return null;

  return {
    slug: slugify(collectionName),
    label: collectionName
  };
}

export function isProductVisible(product = {}) {
  return product?.visible !== false &&
    product?.hidden !== true &&
    product?.is_deleted !== true &&
    product?.deleted !== true;
}

export function isVariantPurchasable(variant = {}) {
  return variant?.is_enabled !== false && variant?.is_available !== false;
}

export function hasPurchasableVariant(product = {}) {
  return Array.isArray(product.variants) && product.variants.some(isVariantPurchasable);
}

export function isProductPurchasable(product = {}) {
  return isProductVisible(product) && hasPurchasableVariant(product);
}

export function getAvailableCollectionSlugs(products = []) {
  return new Set(
    products
      .filter(isProductPurchasable)
      .map(product => inferProductCollection(product)?.slug)
      .filter(Boolean)
  );
}

export function filterCollectionsByPurchasableProducts(collections = [], products = []) {
  const availableSlugs = getAvailableCollectionSlugs(products);

  return collections.filter(collection =>
    availableSlugs.has(slugify(collection.id || collection.name))
  );
}
