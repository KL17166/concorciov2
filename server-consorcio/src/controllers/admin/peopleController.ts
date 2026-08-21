import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../../config/database';
import { logger } from '../../config/logger';
import { hashPassword } from '../../security/password';
import { ALL_VALID_ROLES } from '../../config/roles';
import { roleLabel } from '../../security/adminCapabilities';

function parseAddress(address?: string | null): Record<string, string> {
    if (!address) return {};
    try {
        return address.startsWith('{') ? JSON.parse(address) : { street: address };
    } catch {
        return { street: address };
    }
}

function serializeAddress(body: Record<string, any>): string | null {
    if (!body.address_street && !body.address_city && !body.address_cep) return null;
    return JSON.stringify({
        cep: body.address_cep || '',
        street: body.address_street || '',
        number: body.address_number || '',
        complement: body.address_complement || '',
        neighborhood: body.address_neighborhood || '',
        city: body.address_city || '',
        state: body.address_state || ''
    });
}

function redirectPeople(res: Response, query = '') {
    return res.redirect(`/admin/people${query}`);
}

export const listPeople = async (req: Request, res: Response) => {
    try {
        const search = typeof req.query.search === 'string' ? req.query.search.trim() : '';
        const role = typeof req.query.role === 'string' && ALL_VALID_ROLES.includes(req.query.role) ? req.query.role : undefined;
        const where: any = {
            ...(role ? { role } : {}),
            ...(search ? {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                    { email: { contains: search, mode: 'insensitive' } },
                    { cpf: { contains: search.replace(/\D/g, '') } }
                ]
            } : {})
        };

        const users = await prisma.user.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
                _count: { select: { subscriptions: true } },
                subscriptions: { select: { status: true } }
            }
        });

        const people = users.map((person: any) => ({
            ...person,
            roleLabel: roleLabel(person.role),
            contractCount: person._count.subscriptions,
            activeContractCount: person.subscriptions.filter((item: any) => ['ACTIVE', 'CONTEMPLATED'].includes(item.status)).length
        }));

        return res.render('pages/people/index', {
            path: '/people',
            people,
            filters: { search, role },
            roleOptions: ALL_VALID_ROLES.map((item) => ({ value: item, label: roleLabel(item) }))
        });
    } catch (error) {
        logger.error('Load unified people directory error:', error);
        req.flash('error_msg', 'Erro ao carregar Pessoas e Contas.');
        return redirectPeople(res);
    }
};

export const newPersonForm = (req: Request, res: Response) => {
    const requestedRole = typeof req.query.role === 'string' && ALL_VALID_ROLES.includes(req.query.role)
        ? req.query.role
        : 'CLIENT';
    const actorRole = (req as any).session?.user?.role;
    const role = actorRole === 'MASTER' ? requestedRole : 'CLIENT';

    return res.render('pages/people/form', {
        path: '/people',
        editing: false,
        person: { role, roleLabel: roleLabel(role) },
        parsedAddress: {},
        canManageAccess: actorRole === 'MASTER'
    });
};

export const createPerson = async (req: Request, res: Response) => {
    try {
        const actorRole = (req as any).session?.user?.role;
        const { name, email, cpf, phone, password, role: requestedRole } = req.body;
        const normalizedCpf = String(cpf || '').replace(/\D/g, '');
        const role = actorRole === 'MASTER' && ALL_VALID_ROLES.includes(requestedRole) ? requestedRole : 'CLIENT';

        if (!name?.trim() || !email?.trim() || normalizedCpf.length !== 11 || !password || password.length < 8) {
            req.flash('error_msg', 'Nome, e-mail, CPF válido e senha com pelo menos 8 caracteres são obrigatórios.');
            return res.redirect('/admin/people/new');
        }

        const existingUser = await prisma.user.findFirst({
            where: { OR: [{ email: email.trim().toLowerCase() }, { cpf: normalizedCpf }] },
            select: { id: true }
        });
        if (existingUser) {
            req.flash('error_msg', 'E-mail ou CPF já cadastrado.');
            return res.redirect('/admin/people/new');
        }

        await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                cpf: normalizedCpf,
                phone: phone?.trim() || null,
                passwordHash: await hashPassword(password),
                role,
                address: serializeAddress(req.body)
            }
        });

        req.flash('success_msg', 'Pessoa/conta criada com sucesso.');
        return redirectPeople(res);
    } catch (error) {
        logger.error('Create unified person error:', error);
        req.flash('error_msg', 'Erro ao criar pessoa/conta.');
        return res.redirect('/admin/people/new');
    }
};

export const personDetails = async (req: Request, res: Response) => {
    try {
        const person = await prisma.user.findUnique({
            where: { id: req.params.id as string },
            include: {
                subscriptions: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        plan: { include: { product: true } },
                        installments: { orderBy: { number: 'asc' }, take: 12 },
                        _count: { select: { bids: true, installments: true } }
                    }
                }
            }
        });

        if (!person) {
            req.flash('error_msg', 'Pessoa/conta não encontrada.');
            return redirectPeople(res);
        }

        return res.render('pages/people/details', {
            path: '/people',
            person: { ...person, roleLabel: roleLabel(person.role) },
            parsedAddress: parseAddress(person.address)
        });
    } catch (error) {
        logger.error('Load unified person details error:', error);
        req.flash('error_msg', 'Erro ao carregar os detalhes.');
        return redirectPeople(res);
    }
};

export const editPersonForm = async (req: Request, res: Response) => {
    try {
        const person = await prisma.user.findUnique({ where: { id: req.params.id as string } });
        if (!person) {
            req.flash('error_msg', 'Pessoa/conta não encontrada.');
            return redirectPeople(res);
        }
        const actorRole = (req as any).session?.user?.role;
        return res.render('pages/people/form', {
            path: '/people',
            editing: true,
            person: { ...person, roleLabel: roleLabel(person.role) },
            parsedAddress: parseAddress(person.address),
            canManageAccess: actorRole === 'MASTER',
            canChangeEmail: ['MASTER', 'MANAGER'].includes(actorRole)
        });
    } catch (error) {
        logger.error('Load unified person edit error:', error);
        req.flash('error_msg', 'Erro ao carregar edição.');
        return redirectPeople(res);
    }
};

export const updateProfile = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const actorRole = (req as any).session?.user?.role;
        const current = await prisma.user.findUnique({ where: { id }, select: { email: true } });
        if (!current) {
            req.flash('error_msg', 'Pessoa/conta não encontrada.');
            return redirectPeople(res);
        }

        const email = String(req.body.email || '').trim().toLowerCase();
        if (!email) {
            req.flash('error_msg', 'O e-mail é obrigatório.');
            return res.redirect(`/admin/people/${id}/edit`);
        }
        if (!['MASTER', 'MANAGER'].includes(actorRole) && email !== current.email) {
            req.flash('error_msg', 'Seu perfil não pode alterar o e-mail.');
            return res.redirect(`/admin/people/${id}/edit`);
        }

        const duplicate = await prisma.user.findFirst({ where: { email, NOT: { id } }, select: { id: true } });
        if (duplicate) {
            req.flash('error_msg', 'Este e-mail já está em uso.');
            return res.redirect(`/admin/people/${id}/edit`);
        }

        await prisma.user.update({
            where: { id },
            data: {
                name: String(req.body.name || '').trim(),
                email,
                phone: req.body.phone?.trim() || null,
                address: serializeAddress(req.body)
            }
        });
        req.flash('success_msg', 'Perfil atualizado com sucesso.');
        return res.redirect(`/admin/people/${id}/edit`);
    } catch (error) {
        logger.error('Update unified person profile error:', error);
        req.flash('error_msg', 'Erro ao atualizar o perfil.');
        return res.redirect(`/admin/people/${req.params.id}/edit`);
    }
};

export const updateAccess = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const actorId = (req as any).session?.user?.id;
        const role = req.body.role;
        if (!ALL_VALID_ROLES.includes(role)) {
            req.flash('error_msg', 'Perfil de acesso inválido.');
            return res.redirect(`/admin/people/${id}/edit`);
        }
        if (id === actorId && role !== 'MASTER') {
            req.flash('error_msg', 'Você não pode remover seu próprio acesso de mestre.');
            return res.redirect(`/admin/people/${id}/edit`);
        }
        await prisma.user.update({ where: { id }, data: { role } });
        req.flash('success_msg', 'Perfil de acesso atualizado.');
        return res.redirect(`/admin/people/${id}/edit`);
    } catch (error) {
        logger.error('Update unified person access error:', error);
        req.flash('error_msg', 'Erro ao atualizar o perfil de acesso.');
        return res.redirect(`/admin/people/${req.params.id}/edit`);
    }
};

export const changePasswordDirectly = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const { password } = req.body;

        if (!password || String(password).trim().length < 6) {
            req.flash('error_msg', 'A nova senha deve ter pelo menos 6 caracteres.');
            return res.redirect(`/admin/people/${id}/edit`);
        }

        const person = await prisma.user.findUnique({ where: { id }, select: { name: true } });
        if (!person) {
            req.flash('error_msg', 'Pessoa/conta não encontrada.');
            return redirectPeople(res);
        }

        const hashedPassword = await hashPassword(String(password).trim());
        await prisma.user.update({
            where: { id },
            data: { passwordHash: hashedPassword }
        });

        req.flash('success_msg', `Senha de ${person.name} alterada com sucesso!`);
        return res.redirect(`/admin/people/${id}/edit`);
    } catch (error) {
        logger.error('Direct password change error:', error);
        req.flash('error_msg', 'Erro ao alterar a senha.');
        return res.redirect(`/admin/people/${req.params.id}/edit`);
    }
};

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const person = await prisma.user.findUnique({ where: { id }, select: { name: true } });
        if (!person) {
            req.flash('error_msg', 'Pessoa/conta não encontrada.');
            return redirectPeople(res);
        }
        const temporaryPassword = crypto.randomBytes(12).toString('base64url').slice(0, 12);
        await prisma.user.update({ where: { id }, data: { passwordHash: await hashPassword(temporaryPassword) } });
        req.flash('success_msg', `Senha temporária de ${person.name}: ${temporaryPassword}`);
        return res.redirect(`/admin/people/${id}`);
    } catch (error) {
        logger.error('Reset unified person password error:', error);
        req.flash('error_msg', 'Erro ao alterar a senha.');
        return res.redirect(`/admin/people/${req.params.id}`);
    }
};

export const deletePerson = async (req: Request, res: Response) => {
    try {
        const id = req.params.id as string;
        const actorId = (req as any).session?.user?.id;
        if (id === actorId) {
            req.flash('error_msg', 'Você não pode excluir a própria conta.');
            return redirectPeople(res);
        }
        await prisma.auditLog.updateMany({ where: { userId: id }, data: { userId: null } });
        await prisma.user.delete({ where: { id } });
        req.flash('success_msg', 'Pessoa/conta excluída com sucesso.');
        return redirectPeople(res);
    } catch (error) {
        logger.error('Delete unified person error:', error);
        req.flash('error_msg', 'Não foi possível excluir esta pessoa/conta.');
        return redirectPeople(res);
    }
};
