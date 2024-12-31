function errorWithStatus(message, status) {
  const error = new Error(message);
  error.status = status;

  return error;
}

function BadRequestError(message = "Bad request") {
  return errorWithStatus(message, 400);
}

function UnauthorizedError(message = "Unauthorized") {
  return errorWithStatus(message, 401);
}

function NotFoundError(message = "Not found") {
  return errorWithStatus(message, 404);
}

module.exports = {
  BadRequestError,
  UnauthorizedError,
  NotFoundError,
};
