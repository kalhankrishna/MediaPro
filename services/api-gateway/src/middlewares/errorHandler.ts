import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import logger from '../lib/logger.js';

export const errorHandler = (error: Error, _req: Request, res: Response, _next: NextFunction) => {
    if (error instanceof ZodError) {
        logger.error({ err: error }, 'Validation error');
        res.status(400).json({
            error: 'Validation failed',
            details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            })),
        });
        return;
    }

    logger.error({ err: error }, 'Unhandled error');
    res.status(500).json({error: "Internal server error"});
}
