import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AdminCapability, capabilitiesForRole, hasCapability } from '../security/adminCapabilities';

function wantsJson(req: Request): boolean {
    return Boolean(req.xhr || req.headers.accept?.includes('application/json') || !req.headers.accept?.includes('text/html'));
}

function deny(req: Request, res: Response, message = 'Você não possui permissão para realizar esta ação.') {
    if (wantsJson(req)) {
        return res.status(403).json({ error: 'FORBIDDEN', message });
    }
    req.flash('error_msg', message);
    const referer = req.get('Referer') || '/admin/dashboard';
    return res.redirect(referer);
}

function attachAdminContext(req: Request, res: Response) {
    const sessionUser = (req as any).session?.user;
    const role = sessionUser?.role;
    const capabilities = capabilitiesForRole(role);

    (req as any).adminContext = {
        userId: sessionUser?.id,
        role,
        capabilities
    };
    res.locals.adminUser = sessionUser || null;
    res.locals.capabilities = capabilities;
    res.locals.hasCapability = (capability: AdminCapability) => hasCapability(role, capability);
}

/**
 * Gate global do painel. Além de autenticar, anexa a política de capacidades
 * que é usada por rotas, controllers e views.
 */
export const isAdmin = async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const session = (req as any).session;
    const role = session?.user?.role;
    if (session && session.user && ['MASTER', 'MANAGER', 'SUPPORT'].includes(role)) {
        attachAdminContext(req, res);

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

    if (wantsJson(req)) {
        return res.status(403).json({
            error: 'UNAUTHORIZED',
            message: 'Apenas administradores autorizados podem acessar esta rota. Faça login como admin.'
        });
    }

    req.flash('error', 'Por favor, faça login como administrador.');
    return res.redirect('/admin/login');
};

export const requireCapability = (capability: AdminCapability) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const role = (req as any).session?.user?.role as string | undefined;
        if (!hasCapability(role, capability)) {
            return deny(req, res, `Seu perfil não pode executar a ação “${capability}”.`);
        }
        attachAdminContext(req, res);
        return next();
    };
};

export const requireAnyCapability = (...capabilities: AdminCapability[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const role = (req as any).session?.user?.role as string | undefined;
        if (!capabilities.some((capability) => hasCapability(role, capability))) {
            return deny(req, res);
        }
        attachAdminContext(req, res);
        return next();
    };
};

/** Compatibilidade para rotas legadas; novas rotas devem usar capacidades. */
export const requireRoles = (roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        const role = (req as any).session?.user?.role as string | undefined;
        if (!role || !roles.includes(role)) {
            return deny(req, res, 'Acesso negado. Nível de permissão insuficiente.');
        }
        attachAdminContext(req, res);
        return next();
    };
};
