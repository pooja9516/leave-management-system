const MAX_LIMIT = 100;

export const parsePagination = (query, defaultLimit = 10) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(MAX_LIMIT, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

export const paginated = (data, total, { page, limit }) => ({
  data,
  pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
});

// Escapes user input so it can be used safely inside a RegExp.
export const escapeRegex = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
