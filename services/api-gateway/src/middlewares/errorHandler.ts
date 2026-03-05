import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";

export const errorHandler = (error: Error, req: Request, res: Response, next: NextFunction) => {
    if (error instanceof ZodError) {
        console.error('Error:', error);
        res.status(400).json({
            error: 'Validation failed',
            details: error.issues.map(err => ({
            field: err.path.join('.'),
            message: err.message,
            })),
        });
        return;
    }

    console.error('Error:', error);
    res.status(500).json({error: "Internal server error"});
}