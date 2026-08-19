import { Request, Response, NextFunction } from 'express';
import { redisClient } from '../config/redis';
import { logger } from '../config/logger';

// =============================================
// DEVICE BINDING MIDDLEWARE
// =============================================
// Validates that the request comes from the same physical device
// that performed the login, using a hardware-backed cryptographically 
// secure token stored in the Flutter app's Secure Storage (Keystore/Keychain).
//
// This mitigates the risk of an attacker extracting the JWT 
// and Session Secrets from memory and using them on another device.
// =============================================

export const deviceBindingMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    // Disabled for Web / Development mode. Can be re-enabled when wrapped in a native app.
    return next();
};
