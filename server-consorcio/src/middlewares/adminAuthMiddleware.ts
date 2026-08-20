import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

/**
 * Middleware to enforce admin role and perform silent JWT renewal.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const session = (req as any).session;
    if (session && session.user && ['MASTER', 'MANAGER', 'SUPPORT'].includes(session.user.role)) {
        // Silent JWT refresh
        const currentToken: string | undefined = session.adminToken;
        if (currentToken) {
            try {
                const payload = jwt.verify(currentToken, process.env.JWT_SECRET as string, {
                    algorithms: ['HS256'],
                }) as any;
                const secondsLeft = payload.exp - Math.floor(Date.now() / 1000);
                if (secondsLeft < 15 * 60) {
                    const freshToken = jwt.sign(
                        { userId: session.user.id, role: session.user.role, type: 'admin_panel' },
                        process.env.JWT_SECRET as string,
                        { algorithm: 'HS256', expiresIn: '2h' } as any
                    );
                    session.adminToken = freshToken;
                    await new Promise<void>((resolve) => session.save(resolve));
                }
            } catch {
                const freshToken = jwt.sign(
                    { userId: session.user.id, role: session.user.role, type: 'admin_panel' },
                    process.env.JWT_SECRET as string,
                    { algorithm: 'HS256', expiresIn: '2h' } as any
                );
                session.adminToken = freshToken;
                await new Promise<void>((resolve) => session.save(resolve));
            }
        }
        return next();
    }

    if (req.xhr || req.headers.accept?.includes('application/json') || !req.headers.accept?.includes('text/html')) {
        return res.status(403).json({
            error: 'Acesso negado',
            message: 'Apenas administradores autorizados podem acessar esta rota. Faça login como admin.'
        });
    }

    req.flash('error', 'Por favor, faça login como administrador.');
    res.redirect('/admin/login');
};
