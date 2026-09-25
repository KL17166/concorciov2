import { Request, Response } from 'express';
import crypto from 'crypto';
import { hashPassword } from '../../security/password';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { paginate, paginationMeta, buildPageUrl } from '../../utils/pagination';
import { ALL_VALID_ROLES } from '../../config/roles';
import { canManageRole } from '../../security/adminCapabilities';

/**
 * LEGADO — as rotas ativas convergem para `peopleController` (ver
 * `routes/admin/userRoutes.ts` e `peopleRoutes.ts`). Mantido por compatibilidade
 * e agora com a MESMA trava anti-escalação: só MASTER define papel privilegiado.
 * B6: sem isso, um MANAGER criava/elevava usuários a MASTER.
 */
function resolveRoleOrDeny(req: Request, res: Response, requestedRole: unknown): string | null {
    const actorRole = (req as any).session?.user?.role;
    const actorId = (req as any).session?.user?.id;
    const safeRequested = typeof requestedRole === 'string' && ALL_VALID_ROLES.includes(requestedRole)
        ? requestedRole
        : 'CLIENT';
    if (safeRequested !== 'CLIENT' && !canManageRole(actorRole, safeRequested)) {
        logger.warn(`[RBAC] Role escalation blocked: actor ${actorId} (${actorRole}) tried to assign ${safeRequested}`);
        req.flash('error_msg', 'Seu perfil não pode atribuir esse nível de acesso. Apenas MASTER gerencia papéis.');
        const back = req.get('Referer') || '/admin/users';
        res.redirect(back);
        return null;
    }
    return safeRequested;
}

// GET /admin/users
export const listUsers = async (req: Request, res: Response) => {
    try {
        const { page, limit, skip } = paginate(req);

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.user.count()
        ]);

        const pagination = paginationMeta(total, page, limit);

        res.render('pages/users/index', {
            path: '/users',
            users,
            pagination,
            buildPageUrl: (p: number) => buildPageUrl('/admin/users', req.query as Record<string, any>, p)
        });
    } catch (error) {
        logger.error('Load users error:', error);
        res.status(500).send('Erro ao carregar usuários');
    }
};

// GET /admin/users/new
export const newUserForm = (req: Request, res: Response) => {
    res.render('pages/users/form', {
        path: '/users',
        editing: false,
        editUser: {},
        parsedAddress: {}
    });
};

// POST /admin/users/new
export const createUser = async (req: Request, res: Response) => {
    try {
        const { name, email, cpf, phone, password, role: requestedRole, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state } = req.body;

        // Check if email already exists
        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email }, { cpf }] }
        });

        if (existingUser) {
            req.flash('error_msg', 'Email ou CPF já cadastrado.');
            return res.redirect('/admin/users/new');
        }

        const hashedPassword = await hashPassword(password);
        
        const role = resolveRoleOrDeny(req, res, requestedRole);
        if (!role) return;
        let formattedAddress = null;
        if (address_street) {
             formattedAddress = JSON.stringify({
                 cep: address_cep || '',
                 street: address_street,
                 number: address_number || '',
                 complement: address_complement || '',
                 neighborhood: address_neighborhood || '',
                 city: address_city || '',
                 state: address_state || ''
             });
        }

        await prisma.user.create({
            data: {
                name,
                email,
                cpf: cpf.replace(/\D/g, ''),
                phone: phone || null,
                passwordHash: hashedPassword,
                role,
                address: formattedAddress
            }
        });

        req.flash('success_msg', 'Usuário criado com sucesso!');
        res.redirect('/admin/users');
    } catch (error) {
        logger.error('Create user error:', error);
        req.flash('error_msg', 'Erro ao criar usuário.');
        res.redirect('/admin/users/new');
    }
};

// GET /admin/users/:id/edit
export const editUserForm = async (req: Request, res: Response) => {
    try {
        const user = await prisma.user.findUnique({ where: { id: req.params.id as string } });
        if (!user) {
            req.flash('error_msg', 'Usuário não encontrado.');
            return res.redirect('/admin/users');
        }
        
        let parsedAddress = {};
        try {
            if (user.address) {
                if (user.address.startsWith('{')) {
                     parsedAddress = JSON.parse(user.address);
                } else {
                     parsedAddress = { street: user.address };
                }
            }
        } catch (e) {
            parsedAddress = { street: user.address };
        }
        
        res.render('pages/users/form', {
            path: '/users',
            editing: true,
            editUser: user,
            parsedAddress
        });
    } catch (error) {
        logger.error('Load user edit error:', error);
        req.flash('error_msg', 'Erro ao carregar usuário.');
        res.redirect('/admin/users');
    }
};

// POST /admin/users/:id/edit
export const updateUser = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const actorId = (req as any).session?.user?.id;
        const { name, email, phone, role: requestedRole, password, address_cep, address_street, address_number, address_complement, address_neighborhood, address_city, address_state } = req.body;

        // B6: trava anti-escalação + anti auto-rebaixamento (antes aceitava qualquer role)
        const role = resolveRoleOrDeny(req, res, requestedRole);
        if (!role) return;
        if (id === actorId && role !== 'MASTER' && (req as any).session?.user?.role === 'MASTER') {
            req.flash('error_msg', 'Você não pode remover seu próprio acesso de mestre.');
            return res.redirect('/admin/users');
        }
        
        let formattedAddress = null;
        if (address_street) {
             formattedAddress = JSON.stringify({
                 cep: address_cep || '',
                 street: address_street,
                 number: address_number || '',
                 complement: address_complement || '',
                 neighborhood: address_neighborhood || '',
                 city: address_city || '',
                 state: address_state || ''
             });
        }

        const data: any = {
            name,
            email,
            phone: phone || null,
            role,
            address: formattedAddress
        };

        if (password && password.trim() !== '') {
            data.passwordHash = await hashPassword(password);
        }

        await prisma.user.update({
            where: { id },
            data
        });

        req.flash('success_msg', 'Usuário atualizado com sucesso!');
        res.redirect('/admin/users');
    } catch (error) {
        logger.error('Update user error:', error);
        req.flash('error_msg', 'Erro ao atualizar usuário.');
        res.redirect('/admin/users');
    }
};

// POST /admin/users/:id/delete
export const deleteUser = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;

        // Note: Prisma Schema uses onDelete: Cascade for Subscriptions -> User, 
        // so deleting the user will automatically wipe out all their contracts, installments, and bids.
        
        // Decouple from any AuditLogs (which don't have cascade delete) to prevent foreign key errors
        await prisma.auditLog.updateMany({
            where: { userId: id },
            data: { userId: null }
        });

        await prisma.user.delete({ where: { id } });

        req.flash('success_msg', 'Usuário excluído com sucesso!');
        res.redirect('/admin/users');
    } catch (error) {
        logger.error('Delete user error:', error);
        req.flash('error_msg', 'Erro ao excluir usuário.');
        res.redirect('/admin/users');
    }
};

// POST /admin/users/:id/reset-password
export const resetPassword = async (req: Request, res: Response) => {
    const id = req.params.id as string;
    try {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) {
            req.flash('error_msg', 'Usuário não encontrado.');
            return res.redirect('/admin/users');
        }

        const newPassword = crypto.randomBytes(12).toString('base64url').slice(0, 12);
        const hashedPassword = await hashPassword(newPassword);

        await prisma.user.update({
            where: { id },
            data: { passwordHash: hashedPassword }
        });

        req.flash('success_msg', `Senha de ${user.name} resetada! Nova senha: ${newPassword}`);
        res.redirect('/admin/users');
    } catch (error) {
        logger.error('User password reset error:', error);
        req.flash('error_msg', 'Erro ao resetar senha do usuário.');
        res.redirect('/admin/users');
    }
};
