/**
 * Custom error classes for standardized error handling
 */

import { createError } from 'h3'
import { logger } from '~/server/utils/logger'

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public statusMessage: string,
    public data?: unknown,
    message?: string
  ) {
    super(message || statusMessage)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, data?: unknown) {
    super(400, 'Validation Error', data, message)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized', data?: unknown) {
    super(401, 'Unauthorized', data, message)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden', data?: unknown) {
    super(403, 'Forbidden', data, message)
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not Found', data?: unknown) {
    super(404, 'Not Found', data, message)
  }
}

export class ConflictError extends AppError {
  constructor(message = 'Conflict', data?: unknown) {
    super(409, 'Conflict', data, message)
  }
}

export class InternalServerError extends AppError {
  constructor(message = 'Internal Server Error', data?: unknown) {
    super(500, 'Internal Server Error', data, message)
  }
}

/**
 * Convert AppError (or Error) to Nuxt error format
 */
export function toNuxtError(error: AppError | Error) {
  if (error instanceof AppError) {
    return {
      statusCode: error.statusCode,
      statusMessage: error.statusMessage,
      data: error.data,
      message: error.message,
    }
  }

  // Plain Error - don't expose internal details in production
  return {
    statusCode: 500,
    statusMessage: 'Internal Server Error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'An unexpected error occurred',
  }
}

/**
 * Use in API route catch blocks: logs the error and throws the correct HTTP response.
 * Preserves statusCode from AppError or from H3-style errors (object with statusCode).
 */
export function handleApiError(error: unknown, context?: string): never {
  logger.error(context ?? 'API error', error)
  if (error instanceof AppError) {
    throw createError(toNuxtError(error))
  }
  const obj = error && typeof error === 'object' ? (error as Record<string, unknown>) : null
  const code = obj && typeof obj['statusCode'] === 'number' ? (obj['statusCode'] as number) : 500
  const message =
    (obj && typeof obj['statusMessage'] === 'string' ? (obj['statusMessage'] as string) : undefined) ||
    (obj && typeof obj['message'] === 'string' ? (obj['message'] as string) : undefined) ||
    (error instanceof Error ? error.message : undefined)
  throw createError({
    statusCode: code,
    statusMessage: message || 'Internal Server Error',
    data: obj && 'data' in obj ? obj['data'] : undefined,
  })
}
